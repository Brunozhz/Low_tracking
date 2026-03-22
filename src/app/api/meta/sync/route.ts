import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureProjectAccess, getSessionUser } from "@/lib/access";
import { db } from "@/lib/db";
import { enqueueMetaSync } from "@/lib/jobs/producers";

const syncSchema = z.object({
  projectId: z.string().min(1),
  adAccountId: z.string().min(1),
  rangeStart: z.string().datetime(),
  rangeEnd: z.string().datetime(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = syncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido", details: parsed.error.flatten() }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, parsed.data.projectId);

  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const adAccount = await db.adAccount.findFirst({
    where: {
      id: parsed.data.adAccountId,
      projectId: project.id,
      isActive: true,
    },
    select: { id: true },
  });

  if (!adAccount) {
    return NextResponse.json({ error: "Conta de anuncios nao encontrada para o projeto" }, { status: 404 });
  }

  const job = await enqueueMetaSync({
    workspaceId: project.workspaceId,
    projectId: project.id,
    adAccountId: adAccount.id,
    rangeStart: parsed.data.rangeStart,
    rangeEnd: parsed.data.rangeEnd,
  });

  return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
}
