import { google } from "googleapis";

const GBP_ACCOUNT_ID = process.env.GBP_ACCOUNT_ID || "";
const GBP_LOCATION_ID = process.env.GBP_LOCATION_ID || "";

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.split("\\n").join("\n"),
    scopes: ["https://www.googleapis.com/auth/business.manage"],
  });
}

/* ── In-memory cache ─────────────────────────────── */

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

/* ── Helpers ─────────────────────────────────────── */

async function gbpFetch(url: string) {
  const auth = getAuth();
  const token = await auth.authorize();

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GBP API error ${res.status}: ${text}`);
  }

  return res.json();
}

/* ── Performance Metrics ─────────────────────────── */

export interface DailyMetric {
  date: string;
  metric: string;
  value: number;
}

const METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
];

export async function getPerformanceMetrics(
  startDate: string,
  endDate: string
): Promise<DailyMetric[]> {
  const cacheKey = `gbp:perf:${startDate}:${endDate}`;
  const cached = getCached<DailyMetric[]>(cacheKey);
  if (cached) return cached;

  const metricsParam = METRICS.join("&dailyMetrics=");
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);

  const url =
    `https://businessprofileperformance.googleapis.com/v1/${GBP_LOCATION_ID}:fetchMultiDailyMetricsTimeSeries` +
    `?dailyMetrics=${metricsParam}` +
    `&dailyRange.startDate.year=${sy}&dailyRange.startDate.month=${sm}&dailyRange.startDate.day=${sd}` +
    `&dailyRange.endDate.year=${ey}&dailyRange.endDate.month=${em}&dailyRange.endDate.day=${ed}`;

  const data = await gbpFetch(url);
  const results: DailyMetric[] = [];

  for (const series of data.multiDailyMetricTimeSeries || []) {
    const metric = series.dailyMetricTimeSeries?.dailyMetric || "UNKNOWN";
    for (const point of series.dailyMetricTimeSeries?.timeSeries
      ?.datedValues || []) {
      const d = point.date;
      if (!d) continue;
      results.push({
        date: `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`,
        metric,
        value: Number(point.value || 0),
      });
    }
  }

  setCache(cacheKey, results);
  return results;
}

/* ── Search Keywords ─────────────────────────────── */

export interface SearchKeyword {
  keyword: string;
  impressions: number;
}

export async function getSearchKeywords(
  yearMonth: string
): Promise<SearchKeyword[]> {
  const cacheKey = `gbp:kw:${yearMonth}`;
  const cached = getCached<SearchKeyword[]>(cacheKey);
  if (cached) return cached;

  const [year, month] = yearMonth.split("-").map(Number);

  const url =
    `https://businessprofileperformance.googleapis.com/v1/${GBP_LOCATION_ID}/searchkeywords/impressions/monthly` +
    `?monthlyRange.startMonth.year=${year}&monthlyRange.startMonth.month=${month}` +
    `&monthlyRange.endMonth.year=${year}&monthlyRange.endMonth.month=${month}`;

  const data = await gbpFetch(url);
  const keywords: SearchKeyword[] = [];

  for (const item of data.searchKeywordsCounts || []) {
    keywords.push({
      keyword: item.searchKeyword || "",
      impressions: Number(
        item.insightsValue?.value || item.insightsValue?.threshold || 0
      ),
    });
  }

  keywords.sort((a, b) => b.impressions - a.impressions);
  setCache(cacheKey, keywords);
  return keywords;
}

/* ── Reviews ─────────────────────────────────────── */

export interface Review {
  reviewId: string;
  reviewer: string;
  rating: string;
  comment: string;
  createTime: string;
  updateTime: string;
  replyComment?: string;
  replyTime?: string;
}

export async function getReviews(
  pageSize = 20,
  pageToken?: string
): Promise<{ reviews: Review[]; nextPageToken?: string; totalReviewCount?: number; averageRating?: number }> {
  const cacheKey = `gbp:reviews:${pageSize}:${pageToken || ""}`;
  const cached = getCached<{ reviews: Review[]; nextPageToken?: string; totalReviewCount?: number; averageRating?: number }>(cacheKey);
  if (cached) return cached;

  let url =
    `https://mybusiness.googleapis.com/v4/${GBP_ACCOUNT_ID}/${GBP_LOCATION_ID}/reviews` +
    `?pageSize=${pageSize}&orderBy=updateTime desc`;
  if (pageToken) url += `&pageToken=${pageToken}`;

  const data = await gbpFetch(url);

  const reviews: Review[] = (data.reviews || []).map(
    (r: Record<string, unknown>) => ({
      reviewId: (r.reviewId as string) || "",
      reviewer:
        ((r.reviewer as Record<string, unknown>)?.displayName as string) || "Anonymous",
      rating: (r.starRating as string) || "UNKNOWN",
      comment: (r.comment as string) || "",
      createTime: (r.createTime as string) || "",
      updateTime: (r.updateTime as string) || "",
      replyComment: (
        (r.reviewReply as Record<string, unknown>)?.comment as string
      ) || undefined,
      replyTime: (
        (r.reviewReply as Record<string, unknown>)?.updateTime as string
      ) || undefined,
    })
  );

  const result = {
    reviews,
    nextPageToken: (data.nextPageToken as string) || undefined,
    totalReviewCount: Number(data.totalReviewCount || 0),
    averageRating: Number(data.averageRating || 0),
  };

  setCache(cacheKey, result);
  return result;
}
