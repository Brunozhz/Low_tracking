import type { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureProjectAccess, getSessionUser } from "@/lib/access";
import { db } from "@/lib/db";
import { buildFinalUrl } from "@/lib/tracking/link-builder";

const linkSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2),
  destinationUrl: z.string().url(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  customParams: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string()).default([]),
  templateId: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId é obrigatório" }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, projectId);
  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const links = await db.trackingLink.findMany({
    where: {
      projectId,
      archivedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ links });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = linkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, parsed.data.projectId);
  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const finalUrl = buildFinalUrl(parsed.data);

  const link = await db.trackingLink.create({
    data: {
      workspaceId: project.workspaceId,
      projectId: project.id,
      createdById: user.id,
      templateId: parsed.data.templateId,
      name: parsed.data.name,
      slug: nanoid(10),
      destinationUrl: parsed.data.destinationUrl,
      finalUrl,
      utmSource: parsed.data.utmSource,
      utmMedium: parsed.data.utmMedium,
      utmCampaign: parsed.data.utmCampaign,
      utmContent: parsed.data.utmContent,
      utmTerm: parsed.data.utmTerm,
      customParams: parsed.data.customParams as Prisma.InputJsonValue | undefined,
      tags: parsed.data.tags,
    },
  });

  return NextResponse.json({ link }, { status: 201 });
}
