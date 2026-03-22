import { env } from "@/lib/env";

type GraphResponse<T> = {
  data?: T[];
  paging?: {
    next?: string;
  };
};

type InsightsRow = Record<string, unknown>;

type CampaignRow = {
  id: string;
  name?: string;
  status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
};

type AdSetRow = {
  id: string;
  campaign_id?: string;
  name?: string;
  status?: string;
  optimization_goal?: string;
  billing_event?: string;
  start_time?: string;
  end_time?: string;
  targeting?: Record<string, unknown>;
};

type CreativePayload = {
  id?: string;
  name?: string;
  thumbnail_url?: string;
  body?: string;
  title?: string;
  object_story_spec?: Record<string, unknown>;
};

type AdRow = {
  id: string;
  campaign_id?: string;
  adset_id?: string;
  name?: string;
  status?: string;
  creative?: CreativePayload;
};

export class MetaAdsClient {
  constructor(private readonly accessToken: string) {}

  private async fetchPaged<T>(url: URL) {
    const items: T[] = [];
    let nextUrl = url.toString();

    while (nextUrl) {
      const response = await fetch(nextUrl, {
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

      const payload = (await response.json()) as GraphResponse<T>;
      items.push(...(payload.data ?? []));
      nextUrl = payload.paging?.next ?? "";
    }

    return items;
  }

  async fetchCampaigns(adAccountId: string) {
    const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/act_${adAccountId}/campaigns`);
    url.searchParams.set(
      "fields",
      ["id", "name", "status", "objective", "daily_budget", "lifetime_budget", "start_time", "stop_time"].join(","),
    );
    url.searchParams.set("limit", "500");
    url.searchParams.set("access_token", this.accessToken);

    return this.fetchPaged<CampaignRow>(url);
  }

  async fetchAdSets(adAccountId: string) {
    const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/act_${adAccountId}/adsets`);
    url.searchParams.set(
      "fields",
      [
        "id",
        "name",
        "status",
        "campaign_id",
        "optimization_goal",
        "billing_event",
        "start_time",
        "end_time",
        "targeting",
      ].join(","),
    );
    url.searchParams.set("limit", "500");
    url.searchParams.set("access_token", this.accessToken);

    return this.fetchPaged<AdSetRow>(url);
  }

  async fetchAds(adAccountId: string) {
    const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/act_${adAccountId}/ads`);
    url.searchParams.set("fields", ["id", "name", "status", "campaign_id", "adset_id", "creative{id,name,thumbnail_url,body,title,object_story_spec}"].join(","));
    url.searchParams.set("limit", "500");
    url.searchParams.set("access_token", this.accessToken);

    return this.fetchPaged<AdRow>(url);
  }

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

    const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/act_${adAccountId}/insights`);

    url.searchParams.set("fields", fields);
    url.searchParams.set("level", "ad");
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("time_range", JSON.stringify({ since, until }));
    url.searchParams.set("limit", "500");
    url.searchParams.set("access_token", this.accessToken);

    return this.fetchPaged<InsightsRow>(url);
  }
}

