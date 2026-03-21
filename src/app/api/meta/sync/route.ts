import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser, ensureProjectAccess } from "@/lib/access";
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
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = syncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, parsed.data.projectId);

  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const job = await enqueueMetaSync({
    workspaceId: project.workspaceId,
    projectId: project.id,
    adAccountId: parsed.data.adAccountId,
    rangeStart: parsed.data.rangeStart,
    rangeEnd: parsed.data.rangeEnd,
  });

  return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
}

