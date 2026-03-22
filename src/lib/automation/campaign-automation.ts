import { subHours } from "date-fns";
import {
  CampaignOptimizationAutomation,
  CampaignOptimizationPreset,
  CampaignOptimizationScope,
  PriorityLevel,
  RecommendationType,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { evaluateCampaignSnapshot } from "@/lib/ai/rules";
import { getCampaignPerformance } from "@/lib/campaigns/performance";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

function getTimeKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${hour}:${minute}`;
}

function getDateTimeKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function shouldRunNow(automation: CampaignOptimizationAutomation, now: Date) {
  if (!automation.enabled) {
    return false;
  }

  const runTimes = automation.runTimes ?? [];
  if (runTimes.length === 0) {
    return false;
  }

  const currentTime = getTimeKey(now, automation.timezone);
  if (!runTimes.includes(currentTime)) {
    return false;
  }

  if (!automation.lastRunAt) {
    return true;
  }

  const lastKey = getDateTimeKey(automation.lastRunAt, automation.timezone);
  const currentKey = getDateTimeKey(now, automation.timezone);
  return lastKey !== currentKey;
}

function presetMultiplier(preset: CampaignOptimizationPreset) {
  switch (preset) {
    case CampaignOptimizationPreset.AGGRESSIVE:
      return { scaleBoost: 1.15, cpaTolerance: 1.1 };
    case CampaignOptimizationPreset.DEFENSIVE:
      return { scaleBoost: 0.85, cpaTolerance: 0.85 };
    case CampaignOptimizationPreset.CREATIVE_RESCUE:
      return { scaleBoost: 0.9, cpaTolerance: 0.95 };
    case CampaignOptimizationPreset.ROAS_GUARD:
      return { scaleBoost: 1.0, cpaTolerance: 0.9 };
    default:
      return { scaleBoost: 1.0, cpaTolerance: 1.0 };
  }
}

async function createRecommendationIfNeeded(input: {
  workspaceId: string;
  projectId: string;
  type: RecommendationType;
  title: string;
  reason: string;
  impactSummary: string;
  actionSuggested: string;
  priority: PriorityLevel;
  priorityScore: number;
  confidenceScore: number;
  data: Prisma.InputJsonValue;
}) {
  const recent = await db.recommendation.findFirst({
    where: {
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      createdAt: {
        gte: subHours(new Date(), 6),
      },
    },
    select: { id: true },
  });

  if (recent) {
    return false;
  }

  await db.recommendation.create({
    data: input,
  });

  return true;
}

export async function executeCampaignAutomation(automation: CampaignOptimizationAutomation) {
  const multiplier = presetMultiplier(automation.preset);
  const campaignIds =
    automation.scope === CampaignOptimizationScope.SELECTED ? automation.selectedCampaignIds : undefined;

  const rows = await getCampaignPerformance({
    projectId: automation.projectId,
    days: 7,
    campaignIds,
  });

  const candidates = rows.filter((row) => {
    if (automation.scope === CampaignOptimizationScope.ALL_ACTIVE) {
      return row.status === "ACTIVE" || row.status === "ACTIVE_WITH_ISSUES" || row.status === null;
    }

    return true;
  });

  let created = 0;

  for (const row of candidates) {
    const base = evaluateCampaignSnapshot({
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: row.ctr,
      cpc: row.cpc,
      cpm: row.cpm,
      cpa: row.cpa,
      conversionRate: row.clicks > 0 ? (row.conversionsReal / row.clicks) * 100 : 0,
      frequency: row.frequency,
      conversionsMeta: row.purchasesMeta,
      conversionsReal: row.conversionsReal,
      roas: row.roas,
      trendCpa3d: "stable",
    });

    if (automation.scaleWinners) {
      for (const recommendation of base.recommendations.filter((item) => item.type === RecommendationType.SCALE_CAMPAIGN)) {
        const okTarget = automation.targetRoas ? row.roas >= automation.targetRoas * multiplier.scaleBoost : row.roas >= 2;
        if (!okTarget) {
          continue;
        }

        const createdNow = await createRecommendationIfNeeded({
          workspaceId: automation.workspaceId,
          projectId: automation.projectId,
          type: recommendation.type,
          title: `[Auto ${automation.name}] ${recommendation.title}`,
          reason: recommendation.reason,
          impactSummary: recommendation.impactSummary,
          actionSuggested: `${recommendation.actionSuggested} Limite de aumento: ${automation.maxBudgetIncreasePercent}%`,
          priority: recommendation.priority,
          priorityScore: recommendation.priorityScore,
          confidenceScore: recommendation.confidenceScore,
          data: {
            ...recommendation.data,
            automationId: automation.id,
            campaignId: row.campaignId,
            campaignExternalId: row.campaignExternalId,
          } as Prisma.InputJsonValue,
        });

        if (createdNow) {
          created += 1;
        }
      }
    }

    if (automation.pauseLosers) {
      const maxCpa = automation.maxCpa ? Number(automation.maxCpa) * multiplier.cpaTolerance : 180;
      const minSpend = automation.minSpend ? Number(automation.minSpend) : 100;

      if (row.spend >= minSpend && row.conversionsReal === 0 && row.roas < 0.8) {
        const createdNow = await createRecommendationIfNeeded({
          workspaceId: automation.workspaceId,
          projectId: automation.projectId,
          type: RecommendationType.PAUSE_CAMPAIGN,
          title: `[Auto ${automation.name}] Pausar campanha com desperdicio: ${row.campaignName}`,
          reason: "Campanha consumindo verba sem conversao real no periodo analisado.",
          impactSummary: "Corte de desperdicio imediato e realocacao de verba para ativos vencedores.",
          actionSuggested: `Pausar ou reduzir ${automation.maxBudgetDecreasePercent}% e revisar publico/angulos de criativo.`,
          priority: PriorityLevel.CRITICAL,
          priorityScore: 94,
          confidenceScore: 0.87,
          data: {
            automationId: automation.id,
            campaignId: row.campaignId,
            campaignExternalId: row.campaignExternalId,
            spend: row.spend,
            roas: row.roas,
            conversionsReal: row.conversionsReal,
          } as Prisma.InputJsonValue,
        });

        if (createdNow) {
          created += 1;
        }
      } else if (row.cpa > maxCpa && row.spend >= minSpend) {
        const createdNow = await createRecommendationIfNeeded({
          workspaceId: automation.workspaceId,
          projectId: automation.projectId,
          type: RecommendationType.REDUCE_BUDGET,
          title: `[Auto ${automation.name}] Reduzir verba por CPA alto: ${row.campaignName}`,
          reason: "CPA acima do limite definido para automacao.",
          impactSummary: "Protecao de margem sem interromper totalmente a campanha.",
          actionSuggested: `Reduzir budget em ${automation.maxBudgetDecreasePercent}% e acompanhar por 48h.`,
          priority: PriorityLevel.HIGH,
          priorityScore: 82,
          confidenceScore: 0.79,
          data: {
            automationId: automation.id,
            campaignId: row.campaignId,
            campaignExternalId: row.campaignExternalId,
            cpa: row.cpa,
            maxCpa,
          } as Prisma.InputJsonValue,
        });

        if (createdNow) {
          created += 1;
        }
      }
    }

    if (automation.refreshCreativeAlerts && row.frequency >= 2.8 && row.ctr < 0.9) {
      const createdNow = await createRecommendationIfNeeded({
        workspaceId: automation.workspaceId,
        projectId: automation.projectId,
        type: RecommendationType.REFRESH_CREATIVE,
        title: `[Auto ${automation.name}] Troca criativa recomendada: ${row.campaignName}`,
        reason: "Frequencia alta com CTR em queda sugere fadiga criativa.",
        impactSummary: "Recuperar CTR e reduzir CPM/CPC no curto prazo.",
        actionSuggested: "Subir novo angulo de criativo e duplicar para teste A/B em 72h.",
        priority: PriorityLevel.HIGH,
        priorityScore: 84,
        confidenceScore: 0.81,
        data: {
          automationId: automation.id,
          campaignId: row.campaignId,
          campaignExternalId: row.campaignExternalId,
          frequency: row.frequency,
          ctr: row.ctr,
        } as Prisma.InputJsonValue,
      });

      if (createdNow) {
        created += 1;
      }
    }

    if (automation.trackingConsistencyCheck && row.conversionGap >= Math.max(5, row.purchasesMeta * 0.25)) {
      const createdNow = await createRecommendationIfNeeded({
        workspaceId: automation.workspaceId,
        projectId: automation.projectId,
        type: RecommendationType.FIX_TRACKING,
        title: `[Auto ${automation.name}] Divergencia Meta x real: ${row.campaignName}`,
        reason: "Diferenca relevante entre compras Meta e conversoes reais da operacao.",
        impactSummary: "Aumento de confiabilidade na tomada de decisao de midia.",
        actionSuggested: "Auditar eventos de venda, deduplicacao e webhook da plataforma de checkout.",
        priority: PriorityLevel.CRITICAL,
        priorityScore: 92,
        confidenceScore: 0.9,
        data: {
          automationId: automation.id,
          campaignId: row.campaignId,
          campaignExternalId: row.campaignExternalId,
          conversionGap: row.conversionGap,
          purchasesMeta: row.purchasesMeta,
          conversionsReal: row.conversionsReal,
        } as Prisma.InputJsonValue,
      });

      if (createdNow) {
        created += 1;
      }
    }
  }

  await db.campaignOptimizationAutomation.update({
    where: { id: automation.id },
    data: { lastRunAt: new Date() },
  });

  return { created };
}

export async function runDueCampaignAutomations() {
  const now = new Date();
  const automations = await db.campaignOptimizationAutomation.findMany({
    where: {
      enabled: true,
    },
  });

  let executed = 0;
  let recommendations = 0;

  for (const automation of automations) {
    if (!shouldRunNow(automation, now)) {
      continue;
    }

    try {
      const result = await executeCampaignAutomation(automation);
      executed += 1;
      recommendations += result.created;
    } catch (error) {
      logger.error({ error, automationId: automation.id }, "Falha ao executar automacao de campanhas");
    }
  }

  return { executed, recommendations };
}

