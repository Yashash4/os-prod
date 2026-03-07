const META_BASE_URL = "https://graph.facebook.com/v21.0";
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || "";

function getParams(extra?: Record<string, string>) {
  const params: Record<string, string> = {
    access_token: process.env.META_ACCESS_TOKEN || "",
    ...extra,
  };
  return params;
}

export async function metaFetch(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${META_BASE_URL}${endpoint}`);
  const allParams = getParams(params);
  Object.entries(allParams).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API error ${res.status}: ${text}`);
  }

  return res.json();
}

/** Paginate through all results using cursor-based pagination */
async function paginateAll(endpoint: string, params?: Record<string, string>, maxPages = 10) {
  const allData: unknown[] = [];

  // Build first URL
  const firstUrl = new URL(`${META_BASE_URL}${endpoint}`);
  const allParams = getParams(params);
  Object.entries(allParams).forEach(([k, v]) => {
    if (v) firstUrl.searchParams.set(k, v);
  });

  let nextUrl = firstUrl.toString();

  for (let page = 0; page < maxPages; page++) {
    const response: Response = await fetch(nextUrl, { cache: "no-store" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Meta API error ${response.status}: ${text}`);
    }
    const json = await response.json();
    const items = json.data || [];
    allData.push(...items);

    const next = json.paging?.next;
    if (!next) break;
    nextUrl = next;
  }

  return allData;
}

/* ── Account Insights ────────────────────────────── */

export async function getAccountInsights(
  datePreset = "last_30d",
  timeIncrement = "1"
) {
  const data = await metaFetch(`/${AD_ACCOUNT_ID}/insights`, {
    fields:
      "spend,impressions,clicks,reach,frequency,cpm,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas",
    date_preset: datePreset,
    time_increment: timeIncrement,
  });
  return data.data || [];
}

/* ── Campaigns ───────────────────────────────────── */

export async function getCampaigns() {
  return paginateAll(`/${AD_ACCOUNT_ID}/campaigns`, {
    fields: "name,status,objective,daily_budget,lifetime_budget,budget_remaining,created_time,updated_time",
    limit: "100",
  });
}

export async function getCampaignInsights(
  campaignId: string,
  datePreset = "last_30d",
  timeIncrement = "1"
) {
  const data = await metaFetch(`/${campaignId}/insights`, {
    fields:
      "spend,impressions,clicks,reach,cpm,ctr,cpc,actions,action_values,cost_per_action_type,purchase_roas",
    date_preset: datePreset,
    time_increment: timeIncrement,
  });
  return data.data || [];
}

/* ── Ad Sets ─────────────────────────────────────── */

export async function getAdSets(campaignId?: string) {
  const endpoint = campaignId
    ? `/${campaignId}/adsets`
    : `/${AD_ACCOUNT_ID}/adsets`;
  return paginateAll(endpoint, {
    fields: "name,status,daily_budget,lifetime_budget,bid_amount,targeting,campaign_id,created_time",
    limit: "100",
  });
}

export async function getAdSetInsights(
  adSetId: string,
  datePreset = "last_30d",
  timeIncrement = "1"
) {
  const data = await metaFetch(`/${adSetId}/insights`, {
    fields:
      "spend,impressions,clicks,reach,cpm,ctr,cpc,actions,action_values,cost_per_action_type",
    date_preset: datePreset,
    time_increment: timeIncrement,
  });
  return data.data || [];
}

/* ── Ads ─────────────────────────────────────────── */

export async function getAds(adSetId?: string) {
  const endpoint = adSetId
    ? `/${adSetId}/ads`
    : `/${AD_ACCOUNT_ID}/ads`;
  return paginateAll(endpoint, {
    fields: "name,status,creative{title,body,image_url,thumbnail_url},adset_id,campaign_id,created_time",
    limit: "100",
  });
}

export async function getAdInsights(
  adId: string,
  datePreset = "last_30d",
  timeIncrement = "1"
) {
  const data = await metaFetch(`/${adId}/insights`, {
    fields:
      "spend,impressions,clicks,reach,cpm,ctr,cpc,actions,action_values,cost_per_action_type",
    date_preset: datePreset,
    time_increment: timeIncrement,
  });
  return data.data || [];
}

/* ── Breakdowns ──────────────────────────────────── */

export async function getInsightsBreakdown(
  breakdown: string,
  datePreset = "last_30d"
) {
  const data = await metaFetch(`/${AD_ACCOUNT_ID}/insights`, {
    fields: "spend,impressions,clicks,reach,cpm,ctr,cpc,actions,purchase_roas",
    date_preset: datePreset,
    breakdowns: breakdown,
    limit: "500",
  });
  return data.data || [];
}
