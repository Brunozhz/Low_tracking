import { EventSource, EventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiKeyContext } from "@/lib/api-key";
import { registerEvent } from "@/lib/tracking/service";

const schema = z.object({
  projectId: z.string().min(1),
  visitor: z.object({
    anonymousId: z.string().min(6),
    externalUserId: z.string().optional(),
    fbp: z.string().optional(),
    fbc: z.string().optional(),
  }),
  session: z.object({
    sessionKey: z.string().min(6),
    landingUrl: z.string().url().optional(),
    referrer: z.string().url().optional(),
    userAgent: z.string().optional(),
    ip: z.string().optional(),
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
  }),
  touchpoint: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      content: z.string().optional(),
      term: z.string().optional(),
      campaignId: z.string().optional(),
      adsetId: z.string().optional(),
      adId: z.string().optional(),
      creativeId: z.string().optional(),
      clickId: z.string().optional(),
      platform: z.string().optional(),
      landingUrl: z.string().url().optional(),
      referrer: z.string().url().optional(),
    })
    .optional(),
  event: z.object({
    type: z.nativeEnum(EventType),
    name: z.string().min(2),
    source: z.nativeEnum(EventSource).optional(),
    status: z.string().optional(),
    occurredAt: z.string().datetime().optional(),
    value: z.number().optional(),
    currency: z.string().optional(),
    orderId: z.string().optional(),
    dedupKey: z.string().optional(),
    eventId: z.string().optional(),
    externalEventId: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    rawPayload: z.record(z.string(), z.unknown()).optional(),
    linkId: z.string().optional(),
  }),
});

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  const context = await getApiKeyContext(apiKey);

  if (!context) {
    return NextResponse.json({ error: "API key inválida" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (context.projectId !== parsed.data.projectId) {
    return NextResponse.json({ error: "API key sem acesso ao projeto" }, { status: 403 });
  }

  const result = await registerEvent({
    workspaceId: context.workspaceId,
    projectId: parsed.data.projectId,
    visitor: parsed.data.visitor,
    session: parsed.data.session,
    touchpoint: parsed.data.touchpoint,
    event: {
      ...parsed.data.event,
      occurredAt: parsed.data.event.occurredAt ? new Date(parsed.data.event.occurredAt) : undefined,
    },
  });

  return NextResponse.json({ status: "ok", data: result }, { status: 201 });
}
