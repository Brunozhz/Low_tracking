import { AttributionModel } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureWorkspaceAccess, getSessionUser } from "@/lib/access";
import { db } from "@/lib/db";

const createProjectSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(2).max(80),
  timezone: z.string().min(3).optional(),
  currency: z.string().length(3).optional(),
  attributionModel: z.enum(["FIRST_TOUCH", "LAST_TOUCH"]).default("LAST_TOUCH"),
});

function slugify(input: string) {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "projeto";
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "N?o autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId ? obrigat?rio" }, { status: 400 });
  }

  const workspace = await ensureWorkspaceAccess(user.id, workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Sem acesso ao workspace" }, { status: 403 });
  }

  const projects = await db.project.findMany({
    where: {
      workspaceId,
      archivedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "N?o autenticado" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = createProjectSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inv?lido", details: parsed.error.flatten() }, { status: 400 });
  }

  const workspace = await ensureWorkspaceAccess(user.id, parsed.data.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Sem acesso ao workspace" }, { status: 403 });
  }

  const project = await db.project.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      name: parsed.data.name,
      slug: `${slugify(parsed.data.name)}-${randomSuffix()}`,
      timezone: parsed.data.timezone ?? "America/Sao_Paulo",
      currency: (parsed.data.currency ?? "BRL").toUpperCase(),
      attributionModel: parsed.data.attributionModel as AttributionModel,
      allowedDomains: [],
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
