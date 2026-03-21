import crypto from "node:crypto";

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

function verifySignature(rawBody: string, signature: string | null) {
  if (!env.WEBHOOK_SIGNING_SECRET || !signature) {
    return null;
  }

  const digest = crypto
    .createHmac("sha256", env.WEBHOOK_SIGNING_SECRET)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: Request) {
  const workspaceId = request.headers.get("x-workspace-id");

  if (!workspaceId) {
    return NextResponse.json({ error: "x-workspace-id obrigatório" }, { status: 400 });
  }

  const rawBody = await request.text();

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
  }

  const signature = request.headers.get("x-signature");
  const signatureValid = verifySignature(rawBody, signature);

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

  return NextResponse.json({ received: true, id: webhook.id }, { status: 202 });
}
