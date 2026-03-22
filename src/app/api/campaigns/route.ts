import { NextResponse } from "next/server";

import { ensureProjectAccess, getSessionUser } from "@/lib/access";
import { getCampaignPerformance } from "@/lib/campaigns/performance";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const days = Number(searchParams.get("days") ?? 7);

  if (!projectId) {
    return NextResponse.json({ error: "projectId obrigatorio" }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, projectId);
  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const campaigns = await getCampaignPerformance({
    projectId: project.id,
    days: Number.isFinite(days) ? Math.min(Math.max(days, 1), 30) : 7,
  });

  return NextResponse.json({ campaigns });
}
