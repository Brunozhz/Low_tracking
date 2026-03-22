import { MetricGranularity, SyncEntity, SyncStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { MetaAdsClient } from "@/lib/meta/client";

function normalizeActions(actionsRaw: unknown) {
  if (!actionsRaw) {
    return [] as Array<{ action_type?: string; value?: string | number }>;
  }

  if (Array.isArray(actionsRaw)) {
    return actionsRaw as Array<{ action_type?: string; value?: string | number }>;
  }

  if (typeof actionsRaw === "string") {
    try {
      const parsed = JSON.parse(actionsRaw) as unknown;
      return Array.isArray(parsed)
        ? (parsed as Array<{ action_type?: string; value?: string | number }>)
        : [];
    } catch {
      return [];
    }
  }

  return [] as Array<{ action_type?: string; value?: string | number }>;
}

function readActionCount(actionsRaw: unknown, key: string) {
  const entries = normalizeActions(actionsRaw);
  const item = entries.find((entry) => entry.action_type === key);
  if (!item?.value) {
    return 0;
  }

  const count = Number(item.value);
  return Number.isFinite(count) ? count : 0;
}

function readMetricNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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
    const adAccount = await db.adAccount.findFirst({
      where: {
        id: input.adAccountId,
        projectId: input.projectId,
        isActive: true,
      },
      select: {
        id: true,
        externalId: true,
      },
    });

    if (!adAccount) {
      throw new Error("Conta de anuncios nao encontrada no projeto.");
    }

    const integration = await db.integration.findFirst({
      where: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        type: "META_ADS",
        status: "CONNECTED",
      },
    });

    if (!integration?.accessTokenEncrypted) {
      throw new Error("Integracao Meta Ads nao encontrada ou sem token.");
    }

    const client = new MetaAdsClient(integration.accessTokenEncrypted);

    const [campaignRows, adSetRows, adRows] = await Promise.all([
      client.fetchCampaigns(adAccount.externalId),
      client.fetchAdSets(adAccount.externalId),
      client.fetchAds(adAccount.externalId),
    ]);

    const campaignIdByExternal = new Map<string, string>();
    const adSetIdByExternal = new Map<string, { id: string; campaignId: string }>();
    const creativeIdByExternal = new Map<string, string>();
    const adByExternal = new Map<string, { id: string; campaignId: string; adSetId: string; creativeId?: string }>();

    for (const row of campaignRows) {
      if (!row.id) {
        continue;
      }

      const campaign = await db.metaCampaign.upsert({
        where: {
          adAccountId_externalId: {
            adAccountId: adAccount.id,
            externalId: row.id,
          },
        },
        update: {
          name: row.name ?? "Campanha sem nome",
          status: row.status,
          objective: row.objective,
          dailyBudget: row.daily_budget ? Number(row.daily_budget) / 100 : null,
          lifetimeBudget: row.lifetime_budget ? Number(row.lifetime_budget) / 100 : null,
          startAt: row.start_time ? new Date(row.start_time) : null,
          endAt: row.stop_time ? new Date(row.stop_time) : null,
        },
        create: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          adAccountId: adAccount.id,
          externalId: row.id,
          name: row.name ?? "Campanha sem nome",
          status: row.status,
          objective: row.objective,
          dailyBudget: row.daily_budget ? Number(row.daily_budget) / 100 : null,
          lifetimeBudget: row.lifetime_budget ? Number(row.lifetime_budget) / 100 : null,
          startAt: row.start_time ? new Date(row.start_time) : null,
          endAt: row.stop_time ? new Date(row.stop_time) : null,
        },
      });

      campaignIdByExternal.set(row.id, campaign.id);
    }

    for (const row of adSetRows) {
      if (!row.id || !row.campaign_id) {
        continue;
      }

      const campaignId = campaignIdByExternal.get(row.campaign_id);
      if (!campaignId) {
        continue;
      }

      const adSet = await db.metaAdSet.upsert({
        where: {
          adAccountId_externalId: {
            adAccountId: adAccount.id,
            externalId: row.id,
          },
        },
        update: {
          campaignId,
          name: row.name ?? "Conjunto sem nome",
          status: row.status,
          optimizationGoal: row.optimization_goal,
          billingEvent: row.billing_event,
          targeting: row.targeting as Prisma.InputJsonValue | undefined,
          startAt: row.start_time ? new Date(row.start_time) : null,
          endAt: row.end_time ? new Date(row.end_time) : null,
        },
        create: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          adAccountId: adAccount.id,
          campaignId,
          externalId: row.id,
          name: row.name ?? "Conjunto sem nome",
          status: row.status,
          optimizationGoal: row.optimization_goal,
          billingEvent: row.billing_event,
          targeting: row.targeting as Prisma.InputJsonValue | undefined,
          startAt: row.start_time ? new Date(row.start_time) : null,
          endAt: row.end_time ? new Date(row.end_time) : null,
        },
      });

      adSetIdByExternal.set(row.id, { id: adSet.id, campaignId });
    }

    for (const row of adRows) {
      if (!row.id || !row.campaign_id || !row.adset_id) {
        continue;
      }

      const campaignId = campaignIdByExternal.get(row.campaign_id);
      const adSet = adSetIdByExternal.get(row.adset_id);
      if (!campaignId || !adSet) {
        continue;
      }

      let creativeId: string | undefined;
      if (row.creative?.id) {
        const creative = await db.metaCreative.upsert({
          where: {
            adAccountId_externalId: {
              adAccountId: adAccount.id,
              externalId: row.creative.id,
            },
          },
          update: {
            name: row.creative.name,
            thumbnailUrl: row.creative.thumbnail_url,
            body: row.creative.body,
            headline: row.creative.title,
            raw: row.creative as Prisma.InputJsonValue,
          },
          create: {
            workspaceId: input.workspaceId,
            projectId: input.projectId,
            adAccountId: adAccount.id,
            externalId: row.creative.id,
            name: row.creative.name,
            thumbnailUrl: row.creative.thumbnail_url,
            body: row.creative.body,
            headline: row.creative.title,
            raw: row.creative as Prisma.InputJsonValue,
          },
        });

        creativeId = creative.id;
        creativeIdByExternal.set(row.creative.id, creative.id);
      }

      const ad = await db.metaAd.upsert({
        where: {
          adAccountId_externalId: {
            adAccountId: adAccount.id,
            externalId: row.id,
          },
        },
        update: {
          campaignId,
          adSetId: adSet.id,
          creativeId,
          name: row.name ?? "Anuncio sem nome",
          status: row.status,
        },
        create: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          adAccountId: adAccount.id,
          campaignId,
          adSetId: adSet.id,
          creativeId,
          externalId: row.id,
          name: row.name ?? "Anuncio sem nome",
          status: row.status,
        },
      });

      adByExternal.set(row.id, {
        id: ad.id,
        campaignId,
        adSetId: adSet.id,
        creativeId,
      });
    }

    const insights = await client.fetchInsights({
      adAccountId: adAccount.externalId,
      since: input.rangeStart.toISOString().slice(0, 10),
      until: input.rangeEnd.toISOString().slice(0, 10),
    });

    let written = 0;

    for (const row of insights) {
      const adExternalId = typeof row.ad_id === "string" ? row.ad_id : "";
      const dateStart = typeof row.date_start === "string" ? row.date_start : "";

      if (!adExternalId || !dateStart) {
        continue;
      }

      const ad = adByExternal.get(adExternalId);
      if (!ad) {
        continue;
      }

      await db.metaMetricDaily.upsert({
        where: {
          date_adAccountId_granularity_entityExternalId: {
            date: new Date(dateStart),
            adAccountId: input.adAccountId,
            granularity: MetricGranularity.AD,
            entityExternalId: adExternalId,
          },
        },
        update: {
          spend: readMetricNumber(row.spend),
          impressions: readMetricNumber(row.impressions),
          reach: readMetricNumber(row.reach),
          clicks: readMetricNumber(row.clicks),
          ctr: readMetricNumber(row.ctr),
          cpc: readMetricNumber(row.cpc),
          cpm: readMetricNumber(row.cpm),
          frequency: readMetricNumber(row.frequency),
          leads: readActionCount(row.actions, "lead"),
          purchases: readActionCount(row.actions, "purchase"),
          syncedAt: new Date(),
          raw: row as Prisma.InputJsonValue,
        },
        create: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          adAccountId: input.adAccountId,
          campaignId: ad.campaignId,
          adSetId: ad.adSetId,
          adId: ad.id,
          granularity: MetricGranularity.AD,
          entityExternalId: adExternalId,
          date: new Date(dateStart),
          spend: readMetricNumber(row.spend),
          impressions: readMetricNumber(row.impressions),
          reach: readMetricNumber(row.reach),
          clicks: readMetricNumber(row.clicks),
          ctr: readMetricNumber(row.ctr),
          cpc: readMetricNumber(row.cpc),
          cpm: readMetricNumber(row.cpm),
          frequency: readMetricNumber(row.frequency),
          leads: readActionCount(row.actions, "lead"),
          purchases: readActionCount(row.actions, "purchase"),
          raw: row as Prisma.InputJsonValue,
        },
      });

      written += 1;
    }

    await db.integration.update({
      where: { id: integration.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    await db.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: SyncStatus.SUCCESS,
        finishedAt: new Date(),
        recordsRead: insights.length,
        recordsWritten: written,
        metadata: {
          importedCampaigns: campaignIdByExternal.size,
          importedAdSets: adSetIdByExternal.size,
          importedAds: adByExternal.size,
          importedCreatives: creativeIdByExternal.size,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      read: insights.length,
      written,
      importedCampaigns: campaignIdByExternal.size,
      importedAdSets: adSetIdByExternal.size,
      importedAds: adByExternal.size,
      importedCreatives: creativeIdByExternal.size,
    };
  } catch (error) {
    logger.error({ error }, "Erro na sincronizacao Meta");

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
