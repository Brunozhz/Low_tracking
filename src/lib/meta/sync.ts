import { MetricGranularity, SyncEntity, SyncStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { MetaAdsClient } from "@/lib/meta/client";

function readActionCount(actionsRaw: string | undefined, key: string) {
  if (!actionsRaw) {
    return 0;
  }

  try {
    const parsed = JSON.parse(actionsRaw) as Array<{ action_type: string; value: string }>;
    const item = parsed.find((entry) => entry.action_type === key);
    return item ? Number(item.value) : 0;
  } catch {
    return 0;
  }
}

export async function syncMetaInsightsByAdAccount(input: {
  workspaceId: string;
  projectId: string;
  adAccountId: string;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const syncLog = await db.syncLog.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      adAccountId: input.adAccountId,
      entity: SyncEntity.INSIGHTS,
      status: SyncStatus.RUNNING,
      startedAt: new Date(),
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
    },
  });

  try {
    const integration = await db.integration.findFirst({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        type: "META_ADS",
        status: "CONNECTED",
      },
    });

    if (!integration?.accessTokenEncrypted) {
      throw new Error("Integração Meta Ads não encontrada ou sem token.");
    }

    const client = new MetaAdsClient(integration.accessTokenEncrypted);

    const data = await client.fetchInsights({
      adAccountId: input.adAccountId,
      since: input.rangeStart.toISOString().slice(0, 10),
      until: input.rangeEnd.toISOString().slice(0, 10),
    });

    let written = 0;

    for (const row of data) {
      const ad = row.ad_id
        ? await db.metaAd.findFirst({
            where: {
              projectId: input.projectId,
              externalId: row.ad_id,
            },
            select: { id: true, campaignId: true, adSetId: true },
          })
        : null;

      if (!ad || !row.date_start) {
        continue;
      }

      await db.metaMetricDaily.upsert({
        where: {
          date_adAccountId_granularity_entityExternalId: {
            date: new Date(row.date_start),
            adAccountId: input.adAccountId,
            granularity: MetricGranularity.AD,
            entityExternalId: row.ad_id,
          },
        },
        update: {
          spend: Number(row.spend ?? 0),
          impressions: Number(row.impressions ?? 0),
          reach: Number(row.reach ?? 0),
          clicks: Number(row.clicks ?? 0),
          ctr: Number(row.ctr ?? 0),
          cpc: Number(row.cpc ?? 0),
          cpm: Number(row.cpm ?? 0),
          frequency: Number(row.frequency ?? 0),
          leads: readActionCount(row.actions, "lead"),
          purchases: readActionCount(row.actions, "purchase"),
          syncedAt: new Date(),
          raw: row,
        },
        create: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          adAccountId: input.adAccountId,
          campaignId: ad.campaignId,
          adSetId: ad.adSetId,
          adId: ad.id,
          granularity: MetricGranularity.AD,
          entityExternalId: row.ad_id,
          date: new Date(row.date_start),
          spend: Number(row.spend ?? 0),
          impressions: Number(row.impressions ?? 0),
          reach: Number(row.reach ?? 0),
          clicks: Number(row.clicks ?? 0),
          ctr: Number(row.ctr ?? 0),
          cpc: Number(row.cpc ?? 0),
          cpm: Number(row.cpm ?? 0),
          frequency: Number(row.frequency ?? 0),
          leads: readActionCount(row.actions, "lead"),
          purchases: readActionCount(row.actions, "purchase"),
          raw: row,
        },
      });

      written += 1;
    }

    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.SUCCESS,
        finishedAt: new Date(),
        recordsRead: data.length,
        recordsWritten: written,
      },
    });

    return { read: data.length, written };
  } catch (error) {
    logger.error({ error }, "Erro na sincronização Meta");

    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.FAILED,
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : "unknown",
      },
    });

    throw error;
  }
}

