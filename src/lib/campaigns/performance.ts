import { subDays } from "date-fns";

import { db } from "@/lib/db";

export type CampaignPerformanceRow = {
  campaignId: string;
  campaignExternalId: string;
  campaignName: string;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchasesMeta: number;
  conversionsReal: number;
  revenueReal: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  frequency: number;
  conversionGap: number;
};

export async function getCampaignPerformance(input: {
  projectId: string;
  days?: number;
  campaignIds?: string[];
}) {
  const days = input.days ?? 7;
  const start = subDays(new Date(), Math.max(1, days - 1));
  const filterCampaignIds = input.campaignIds && input.campaignIds.length > 0 ? input.campaignIds : undefined;

  const campaigns = await db.metaCampaign.findMany({
    where: {
      projectId: input.projectId,
      ...(filterCampaignIds ? { id: { in: filterCampaignIds } } : {}),
    },
    select: {
      id: true,
      externalId: true,
      name: true,
      status: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const campaignIdList = campaigns.map((campaign) => campaign.id);
  if (campaignIdList.length === 0) {
    return [] as CampaignPerformanceRow[];
  }

  const [metrics, conversionGroups] = await Promise.all([
    db.metaMetricDaily.findMany({
      where: {
        projectId: input.projectId,
        campaignId: { in: campaignIdList },
        date: { gte: start },
      },
      select: {
        campaignId: true,
        spend: true,
        impressions: true,
        clicks: true,
        purchases: true,
        frequency: true,
      },
    }),
    db.conversion.groupBy({
      by: ["campaignId"],
      where: {
        projectId: input.projectId,
        occurredAt: { gte: start },
        campaignId: { not: null, in: campaignIdList },
        status: "APPROVED",
      },
      _count: true,
      _sum: {
        revenue: true,
      },
    }),
  ]);

  const conversionMap = new Map(
    conversionGroups
      .filter((item) => item.campaignId)
      .map((item) => [
        item.campaignId as string,
        {
          count: item._count,
          revenue: Number(item._sum.revenue ?? 0),
        },
      ]),
  );

  const metricAgg = new Map<
    string,
    {
      spend: number;
      impressions: number;
      clicks: number;
      purchasesMeta: number;
      frequencySum: number;
      samples: number;
    }
  >();

  for (const row of metrics) {
    if (!row.campaignId) {
      continue;
    }

    const current = metricAgg.get(row.campaignId) ?? {
      spend: 0,
      impressions: 0,
      clicks: 0,
      purchasesMeta: 0,
      frequencySum: 0,
      samples: 0,
    };

    current.spend += Number(row.spend);
    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.purchasesMeta += row.purchases;
    current.frequencySum += row.frequency;
    current.samples += 1;

    metricAgg.set(row.campaignId, current);
  }

  const output = campaigns.map((campaign) => {
    const m = metricAgg.get(campaign.id) ?? {
      spend: 0,
      impressions: 0,
      clicks: 0,
      purchasesMeta: 0,
      frequencySum: 0,
      samples: 0,
    };

    const real = conversionMap.get(campaign.id) ?? { count: 0, revenue: 0 };

    const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
    const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
    const cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0;
    const cpa = real.count > 0 ? m.spend / real.count : m.spend;
    const roas = m.spend > 0 ? real.revenue / m.spend : 0;
    const frequency = m.samples > 0 ? m.frequencySum / m.samples : 0;

    return {
      campaignId: campaign.id,
      campaignExternalId: campaign.externalId,
      campaignName: campaign.name,
      status: campaign.status,
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      purchasesMeta: m.purchasesMeta,
      conversionsReal: real.count,
      revenueReal: real.revenue,
      ctr,
      cpc,
      cpm,
      cpa,
      roas,
      frequency,
      conversionGap: m.purchasesMeta - real.count,
    } satisfies CampaignPerformanceRow;
  });

  return output.sort((a, b) => b.spend - a.spend || b.impressions - a.impressions);
}
