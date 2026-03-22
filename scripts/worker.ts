import "dotenv/config";

import { Worker } from "bullmq";
import { subDays } from "date-fns";
import { InsightType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { evaluateCampaignSnapshot } from "../src/lib/ai/rules";
import { runDueCampaignAutomations } from "../src/lib/automation/campaign-automation";
import { buildExecutiveSummary } from "../src/lib/ai/summarizer";
import { JOB_NAMES } from "../src/lib/constants";
import { db } from "../src/lib/db";
import { redisConnection } from "../src/lib/jobs/queues";
import { logger } from "../src/lib/logger";
import { syncMetaInsightsByAdAccount } from "../src/lib/meta/sync";

const metaWorker = new Worker(
  JOB_NAMES.META_SYNC,
  async (job) => {
    const data = job.data as {
      workspaceId: string;
      projectId: string;
      adAccountId: string;
      rangeStart: string;
      rangeEnd: string;
    };

    return syncMetaInsightsByAdAccount({
      workspaceId: data.workspaceId,
      projectId: data.projectId,
      adAccountId: data.adAccountId,
      rangeStart: new Date(data.rangeStart),
      rangeEnd: new Date(data.rangeEnd),
    });
  },
  { connection: redisConnection },
);

const insightsWorker = new Worker(
  JOB_NAMES.INSIGHTS_DAILY,
  async (job) => {
    const data = job.data as {
      workspaceId: string;
      projectId: string;
    };

    const rangeStart = subDays(new Date(), 7);

    const metrics = await db.metaMetricDaily.findMany({
      where: {
        projectId: data.projectId,
        date: {
          gte: rangeStart,
        },
      },
      include: {
        campaign: true,
      },
    });

    const conversionGroups = await db.conversion.groupBy({
      by: ["campaignId"],
      where: {
        projectId: data.projectId,
        occurredAt: {
          gte: rangeStart,
        },
      },
      _count: true,
      _sum: {
        revenue: true,
      },
    });

    const conversionMap = new Map(
      conversionGroups.filter((item) => item.campaignId).map((item) => [item.campaignId as string, item]),
    );

    const byCampaign = new Map<
      string,
      {
        campaignName: string;
        spend: number;
        impressions: number;
        clicks: number;
        conversionsMeta: number;
        ctr: number;
        cpc: number;
        cpm: number;
        frequency: number;
      }
    >();

    for (const item of metrics) {
      if (!item.campaignId) {
        continue;
      }

      const current = byCampaign.get(item.campaignId) ?? {
        campaignName: item.campaign?.name ?? "Campanha sem nome",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversionsMeta: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        frequency: 0,
      };

      current.spend += Number(item.spend);
      current.impressions += item.impressions;
      current.clicks += item.clicks;
      current.conversionsMeta += item.purchases;
      current.ctr += item.ctr;
      current.cpc += Number(item.cpc);
      current.cpm += Number(item.cpm);
      current.frequency += item.frequency;

      byCampaign.set(item.campaignId, current);
    }

    const highlights: string[] = [];
    const risks: string[] = [];
    const actions: string[] = [];

    for (const [campaignId, agg] of byCampaign.entries()) {
      const conversionsReal = conversionMap.get(campaignId)?._count ?? 0;
      const revenue = Number(conversionMap.get(campaignId)?._sum.revenue ?? 0);
      const ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
      const cpa = conversionsReal > 0 ? agg.spend / conversionsReal : agg.spend;
      const conversionRate = agg.clicks > 0 ? (conversionsReal / agg.clicks) * 100 : 0;
      const roas = agg.spend > 0 ? revenue / agg.spend : 0;

      const analysis = evaluateCampaignSnapshot({
        campaignId,
        campaignName: agg.campaignName,
        spend: agg.spend,
        impressions: agg.impressions,
        clicks: agg.clicks,
        ctr,
        cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
        cpm: agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
        cpa,
        conversionRate,
        frequency: agg.frequency,
        conversionsMeta: agg.conversionsMeta,
        conversionsReal,
        roas,
        trendCpa3d: "stable",
      });

      for (const recommendation of analysis.recommendations) {
        await db.recommendation.create({
          data: {
            workspaceId: data.workspaceId,
            projectId: data.projectId,
            type: recommendation.type,
            title: recommendation.title,
            reason: recommendation.reason,
            impactSummary: recommendation.impactSummary,
            actionSuggested: recommendation.actionSuggested,
            priority: recommendation.priority,
            priorityScore: recommendation.priorityScore,
            confidenceScore: recommendation.confidenceScore,
            data: recommendation.data as Prisma.InputJsonValue,
          },
        });

        actions.push(recommendation.actionSuggested);
      }

      for (const alert of analysis.alerts) {
        await db.alert.create({
          data: {
            workspaceId: data.workspaceId,
            projectId: data.projectId,
            type: alert.type,
            title: alert.title,
            message: alert.message,
            priority: alert.priority,
            status: "OPEN",
            metricName: alert.metricName,
            metricValue: alert.metricValue,
            threshold: alert.threshold,
            firstTriggeredAt: new Date(),
            lastTriggeredAt: new Date(),
          },
        });

        risks.push(alert.message);
      }

      if (roas > 2) {
        highlights.push(`${agg.campaignName} com ROAS ${roas.toFixed(2)}`);
      }
    }

    const summary = await buildExecutiveSummary({
      periodLabel: "Ultimos 7 dias",
      highlights,
      risks,
      actions,
    });

    await db.insight.create({
      data: {
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        type: InsightType.DAILY_SUMMARY,
        title: "Resumo inteligente diario",
        summary,
        periodStart: rangeStart,
        periodEnd: new Date(),
        priorityScore: 72,
        confidenceScore: 0.78,
        data: {
          highlights,
          risks,
          actions,
        } as Prisma.InputJsonValue,
      },
    });

    return { campaigns: byCampaign.size };
  },
  { connection: redisConnection },
);

metaWorker.on("completed", (job) => logger.info({ jobId: job.id }, "Meta sync finalizado"));
metaWorker.on("failed", (job, error) => logger.error({ jobId: job?.id, error }, "Meta sync falhou"));
insightsWorker.on("completed", (job) => logger.info({ jobId: job.id }, "Insights diarios finalizados"));
insightsWorker.on("failed", (job, error) => logger.error({ jobId: job?.id, error }, "Insights diarios falharam"));

logger.info("Workers iniciados: meta-sync e insights-daily");

const AUTOMATION_CHECK_INTERVAL_MS = 60 * 1000;

async function runAutomationTick() {
  try {
    const result = await runDueCampaignAutomations();
    if (result.executed > 0) {
      logger.info({ executed: result.executed, recommendations: result.recommendations }, "Automacoes de campanha executadas");
    }
  } catch (error) {
    logger.error({ error }, "Falha no tick de automacoes");
  }
}

void runAutomationTick();
setInterval(() => {
  void runAutomationTick();
}, AUTOMATION_CHECK_INTERVAL_MS);



