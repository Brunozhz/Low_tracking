import crypto from "node:crypto";

import { EventSource, EventType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { registerEvent } from "@/lib/tracking/service";

function verifySignature(rawBody: string, signature: string | null) {
  if (!env.WEBHOOK_SIGNING_SECRET || !signature) {
    return null;
  }

  const normalizedSignature = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const digest = crypto.createHmac("sha256", env.WEBHOOK_SIGNING_SECRET).update(rawBody).digest("hex");

  if (normalizedSignature.length !== digest.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(normalizedSignature, "hex"), Buffer.from(digest, "hex"));
  } catch {
    return false;
  }
}
function readNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function inferEventType(payload: Record<string, unknown>) {
  const rawStatus = String(
    payload.status ?? payload.orderStatus ?? payload.paymentStatus ?? payload.eventType ?? payload.type ?? "",
  ).toUpperCase();

  if (rawStatus.includes("REFUND") || rawStatus.includes("REEMBOLSO")) {
    return { type: EventType.REFUND, status: "refunded" };
  }

  if (rawStatus.includes("DECLIN") || rawStatus.includes("RECUS") || rawStatus.includes("CHARGEBACK")) {
    return { type: EventType.PURCHASE_DECLINED, status: "declined" };
  }

  if (
    rawStatus.includes("APPROV") ||
    rawStatus.includes("PAID") ||
    rawStatus.includes("PAGO") ||
    rawStatus.includes("COMPLETE")
  ) {
    return { type: EventType.PURCHASE_APPROVED, status: "approved" };
  }

  return { type: EventType.CUSTOM, status: rawStatus.toLowerCase() || "received" };
}

export async function POST(request: Request) {
  const workspaceId = request.headers.get("x-workspace-id");

  if (!workspaceId) {
    return NextResponse.json({ error: "x-workspace-id obrigatorio" }, { status: 400 });
  }

  const rawBody = await request.text();

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload JSON invalido" }, { status: 400 });
  }

  const signature = request.headers.get("x-signature");
  const signatureValid = verifySignature(rawBody, signature);

  if (env.WEBHOOK_SIGNING_SECRET && signature && signatureValid === false) {
    return NextResponse.json({ error: "Assinatura invalida" }, { status: 401 });
  }

  const webhook = await db.webhookDelivery.create({
    data: {
      workspaceId,
      projectId: (payload.projectId as string | undefined) ?? null,
      source: (payload.source as string | undefined) ?? "external",
      providerEventId: (payload.eventId as string | undefined) ?? null,
      signatureValid,
      headers: Object.fromEntries(request.headers.entries()) as Prisma.InputJsonValue,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  try {
    const projectId = String(payload.projectId ?? "").trim();

    if (projectId) {
      const project = await db.project.findFirst({
        where: {
          id: projectId,
          workspaceId,
        },
        select: { id: true, workspaceId: true },
      });

      if (project) {
        const eventType = inferEventType(payload);
        const amount = readNumber(payload.amount ?? payload.total ?? payload.value);
        const orderId = String(payload.orderId ?? payload.order_id ?? payload.transactionId ?? payload.txid ?? "").trim() || undefined;
        const anonymousId =
          String(payload.anonymousId ?? payload.visitorId ?? payload.customerId ?? payload.email ?? orderId ?? webhook.id).trim();
        const sessionKey = String(payload.sessionKey ?? payload.session_id ?? orderId ?? anonymousId).trim();

        await registerEvent({
          workspaceId: project.workspaceId,
          projectId: project.id,
          visitor: {
            anonymousId,
            externalUserId: String(payload.customerId ?? payload.userId ?? "").trim() || undefined,
            fbp: String(payload.fbp ?? "").trim() || undefined,
            fbc: String(payload.fbc ?? "").trim() || undefined,
          },
          session: {
            sessionKey,
            landingUrl: String(payload.landingUrl ?? payload.url ?? "").trim() || undefined,
            referrer: String(payload.referrer ?? "").trim() || undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
          },
          touchpoint: {
            source: String(payload.utm_source ?? payload.source ?? "").trim() || undefined,
            medium: String(payload.utm_medium ?? payload.medium ?? "").trim() || undefined,
            campaign: String(payload.utm_campaign ?? payload.campaign ?? "").trim() || undefined,
            content: String(payload.utm_content ?? payload.content ?? "").trim() || undefined,
            term: String(payload.utm_term ?? payload.term ?? "").trim() || undefined,
            campaignId: String(payload.campaign_id ?? payload.campaignId ?? "").trim() || undefined,
            adsetId: String(payload.adset_id ?? payload.adsetId ?? "").trim() || undefined,
            adId: String(payload.ad_id ?? payload.adId ?? "").trim() || undefined,
            creativeId: String(payload.creative_id ?? payload.creativeId ?? "").trim() || undefined,
            clickId: String(payload.click_id ?? payload.fbclid ?? payload.gclid ?? "").trim() || undefined,
            platform: String(payload.platform ?? "webhook").trim(),
          },
          event: {
            type: eventType.type,
            name: String(payload.name ?? payload.eventName ?? payload.type ?? eventType.type).trim(),
            source: EventSource.WEBHOOK,
            status: eventType.status,
            occurredAt: payload.occurredAt ? new Date(String(payload.occurredAt)) : new Date(),
            value: amount,
            currency: String(payload.currency ?? "BRL").trim() || undefined,
            orderId,
            dedupKey: String(payload.dedupKey ?? payload.eventId ?? orderId ?? webhook.id).trim(),
            externalEventId: String(payload.eventId ?? "").trim() || undefined,
            properties: payload,
            rawPayload: payload,
          },
        });
      }
    }

    await db.webhookDelivery.update({
      where: { id: webhook.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    return NextResponse.json({ received: true, id: webhook.id, processed: true }, { status: 202 });
  } catch (error) {
    await db.webhookDelivery.update({
      where: { id: webhook.id },
      data: {
        status: "FAILED",
        processedAt: new Date(),
        error: error instanceof Error ? error.message : "unknown",
      },
    });

    return NextResponse.json(
      {
        received: true,
        id: webhook.id,
        processed: false,
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 202 },
    );
  }
}

