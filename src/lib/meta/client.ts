import { env } from "@/lib/env";

type InsightsResponse = {
  data?: Array<Record<string, string>>;
  paging?: {
    next?: string;
  };
};

export class MetaAdsClient {
  constructor(private readonly accessToken: string) {}

  async fetchInsights({
    adAccountId,
    since,
    until,
  }: {
    adAccountId: string;
    since: string;
    until: string;
  }) {
    const fields = [
      "date_start",
      "campaign_id",
      "adset_id",
      "ad_id",
      "spend",
      "impressions",
      "reach",
      "clicks",
      "outbound_clicks",
      "actions",
      "action_values",
      "ctr",
      "cpc",
      "cpm",
      "frequency",
    ].join(",");

    const url = new URL(
      `https://graph.facebook.com/${env.META_GRAPH_VERSION}/act_${adAccountId}/insights`,
    );

    url.searchParams.set("fields", fields);
    url.searchParams.set("level", "ad");
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("time_range", JSON.stringify({ since, until }));
    url.searchParams.set("access_token", this.accessToken);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Meta API error: ${response.status} ${details}`);
    }

    const payload = (await response.json()) as InsightsResponse;
    return payload.data ?? [];
  }
}

