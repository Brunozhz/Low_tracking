export type TrackingParams = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  creativeId?: string;
  clickId?: string;
  fbclid?: string;
  gclid?: string;
};

export function parseTrackingParams(searchParams: URLSearchParams): TrackingParams {
  return {
    utmSource: searchParams.get("utm_source") ?? undefined,
    utmMedium: searchParams.get("utm_medium") ?? undefined,
    utmCampaign: searchParams.get("utm_campaign") ?? undefined,
    utmContent: searchParams.get("utm_content") ?? undefined,
    utmTerm: searchParams.get("utm_term") ?? undefined,
    campaignId: searchParams.get("campaign_id") ?? undefined,
    adsetId: searchParams.get("adset_id") ?? undefined,
    adId: searchParams.get("ad_id") ?? undefined,
    creativeId: searchParams.get("creative_id") ?? undefined,
    clickId: searchParams.get("click_id") ?? undefined,
    fbclid: searchParams.get("fbclid") ?? undefined,
    gclid: searchParams.get("gclid") ?? undefined,
  };
}

