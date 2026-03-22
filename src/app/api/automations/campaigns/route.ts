import { CampaignOptimizationPreset, CampaignOptimizationScope } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureProjectAccess, getSessionUser } from "@/lib/access";
import { db } from "@/lib/db";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const createAutomationSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(3).max(120),
  timezone: z.string().min(3).default("America/Sao_Paulo"),
  runTimes: z.array(z.string().regex(timeRegex)).min(1),
  scope: z.enum(["ALL_ACTIVE", "SELECTED"]).default("ALL_ACTIVE"),
  selectedCampaignIds: z.array(z.string()).default([]),
  preset: z
    .enum(["BALANCED", "AGGRESSIVE", "DEFENSIVE", "CREATIVE_RESCUE", "ROAS_GUARD"])
    .default("BALANCED"),
  minSpend: z.number().nonnegative().optional(),
  targetRoas: z.number().nonnegative().optional(),
  maxCpa: z.number().nonnegative().optional(),
  maxBudgetIncreasePercent: z.number().int().min(1).max(100).default(20),
  maxBudgetDecreasePercent: z.number().int().min(1).max(100).default(20),
  pauseLosers: z.boolean().default(true),
  scaleWinners: z.boolean().default(true),
  refreshCreativeAlerts: z.boolean().default(true),
  trackingConsistencyCheck: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

const patchAutomationSchema = z.object({
  projectId: z.string().min(1),
  automationId: z.string().min(1),
  enabled: z.boolean().optional(),
  runTimes: z.array(z.string().regex(timeRegex)).optional(),
  scope: z.enum(["ALL_ACTIVE", "SELECTED"]).optional(),
  selectedCampaignIds: z.array(z.string()).optional(),
  preset: z.enum(["BALANCED", "AGGRESSIVE", "DEFENSIVE", "CREATIVE_RESCUE", "ROAS_GUARD"]).optional(),
});

const deleteAutomationSchema = z.object({
  projectId: z.string().min(1),
  automationId: z.string().min(1),
});

function normalizeTimes(times: string[]) {
  return Array.from(new Set(times)).sort((a, b) => a.localeCompare(b));
}

function normalizeCampaignIds(ids: string[]) {
  return Array.from(
    new Set(
      ids
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}

async function assertCampaignIdsInProject(projectId: string, ids: string[]) {
  if (ids.length === 0) {
    return true;
  }

  const campaigns = await db.metaCampaign.findMany({
    where: {
      projectId,
      id: { in: ids },
    },
    select: { id: true },
  });

  return campaigns.length === ids.length;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId obrigatorio" }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, projectId);
  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const automations = await db.campaignOptimizationAutomation.findMany({
    where: { projectId: project.id },
    orderBy: [{ enabled: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ automations });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = createAutomationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido", details: parsed.error.flatten() }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, parsed.data.projectId);
  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const selectedCampaignIds = normalizeCampaignIds(parsed.data.selectedCampaignIds);

  if (parsed.data.scope === "SELECTED" && selectedCampaignIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos uma campanha para escopo selecionado" }, { status: 400 });
  }

  const validCampaignIds = await assertCampaignIdsInProject(project.id, selectedCampaignIds);
  if (!validCampaignIds) {
    return NextResponse.json({ error: "Uma ou mais campanhas selecionadas nao pertencem ao projeto" }, { status: 400 });
  }

  const automation = await db.campaignOptimizationAutomation.create({
    data: {
      workspaceId: project.workspaceId,
      projectId: project.id,
      createdById: user.id,
      name: parsed.data.name,
      enabled: parsed.data.enabled,
      timezone: parsed.data.timezone,
      runTimes: normalizeTimes(parsed.data.runTimes),
      scope: parsed.data.scope as CampaignOptimizationScope,
      selectedCampaignIds,
      preset: parsed.data.preset as CampaignOptimizationPreset,
      minSpend: parsed.data.minSpend,
      targetRoas: parsed.data.targetRoas,
      maxCpa: parsed.data.maxCpa,
      maxBudgetIncreasePercent: parsed.data.maxBudgetIncreasePercent,
      maxBudgetDecreasePercent: parsed.data.maxBudgetDecreasePercent,
      pauseLosers: parsed.data.pauseLosers,
      scaleWinners: parsed.data.scaleWinners,
      refreshCreativeAlerts: parsed.data.refreshCreativeAlerts,
      trackingConsistencyCheck: parsed.data.trackingConsistencyCheck,
    },
  });

  return NextResponse.json({ automation }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = patchAutomationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido", details: parsed.error.flatten() }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, parsed.data.projectId);
  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  const automation = await db.campaignOptimizationAutomation.findFirst({
    where: {
      id: parsed.data.automationId,
      projectId: project.id,
    },
    select: {
      id: true,
      scope: true,
      selectedCampaignIds: true,
    },
  });

  if (!automation) {
    return NextResponse.json({ error: "Automacao nao encontrada" }, { status: 404 });
  }

  const nextScope = (parsed.data.scope as CampaignOptimizationScope | undefined) ?? automation.scope;
  const nextSelectedCampaignIds =
    parsed.data.selectedCampaignIds !== undefined
      ? normalizeCampaignIds(parsed.data.selectedCampaignIds)
      : automation.selectedCampaignIds;

  if (nextScope === CampaignOptimizationScope.SELECTED && nextSelectedCampaignIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos uma campanha para escopo selecionado" }, { status: 400 });
  }

  const validCampaignIds = await assertCampaignIdsInProject(project.id, nextSelectedCampaignIds);
  if (!validCampaignIds) {
    return NextResponse.json({ error: "Uma ou mais campanhas selecionadas nao pertencem ao projeto" }, { status: 400 });
  }

  const updated = await db.campaignOptimizationAutomation.update({
    where: { id: automation.id },
    data: {
      ...(typeof parsed.data.enabled === "boolean" ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.runTimes ? { runTimes: normalizeTimes(parsed.data.runTimes) } : {}),
      ...(parsed.data.scope ? { scope: parsed.data.scope as CampaignOptimizationScope } : {}),
      ...(parsed.data.selectedCampaignIds !== undefined
        ? { selectedCampaignIds: normalizeCampaignIds(parsed.data.selectedCampaignIds) }
        : {}),
      ...(parsed.data.preset ? { preset: parsed.data.preset as CampaignOptimizationPreset } : {}),
    },
  });

  return NextResponse.json({ automation: updated });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = deleteAutomationSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido", details: parsed.error.flatten() }, { status: 400 });
  }

  const project = await ensureProjectAccess(user.id, parsed.data.projectId);
  if (!project) {
    return NextResponse.json({ error: "Sem acesso ao projeto" }, { status: 403 });
  }

  await db.campaignOptimizationAutomation.deleteMany({
    where: {
      id: parsed.data.automationId,
      projectId: project.id,
    },
  });

  return NextResponse.json({ deleted: true });
}
