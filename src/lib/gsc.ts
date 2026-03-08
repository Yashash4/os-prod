import { google } from "googleapis";

const SITE_URL = process.env.GSC_SITE_URL || "";

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.split("\\n").join("\n"),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

/* ── In-memory cache ─────────────────────────────── */

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

/* ── Search Analytics ────────────────────────────── */

export interface SearchAnalyticsParams {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  type?: string;
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: { groupType?: string; filters?: { dimension?: string; operator?: string; expression?: string }[] }[];
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getSearchAnalytics(
  params: SearchAnalyticsParams
): Promise<SearchAnalyticsRow[]> {
  const cacheKey = `sa:${JSON.stringify(params)}`;
  const cached = getCached<SearchAnalyticsRow[]>(cacheKey);
  if (cached) return cached;

  const auth = getAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const res = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions || ["query"],
      type: params.type || "web",
      rowLimit: params.rowLimit || 500,
      startRow: params.startRow || 0,
      ...(params.dimensionFilterGroups
        ? { dimensionFilterGroups: params.dimensionFilterGroups }
        : {}),
    },
  });

  const rows = (res.data.rows || []) as SearchAnalyticsRow[];
  setCache(cacheKey, rows);
  return rows;
}

/* ── Sitemaps ────────────────────────────────────── */

export interface SitemapEntry {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending: boolean;
  isSitemapsIndex: boolean;
  warnings: string;
  errors: string;
  contents?: { type: string; submitted: string; indexed: string }[];
}

export async function getSitemaps(): Promise<SitemapEntry[]> {
  const cacheKey = "sitemaps";
  const cached = getCached<SitemapEntry[]>(cacheKey);
  if (cached) return cached;

  const auth = getAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const res = await searchconsole.sitemaps.list({ siteUrl: SITE_URL });

  const sitemaps = (res.data.sitemap || []).map((s) => ({
    path: s.path || "",
    lastSubmitted: s.lastSubmitted || undefined,
    lastDownloaded: s.lastDownloaded || undefined,
    isPending: s.isPending || false,
    isSitemapsIndex: s.isSitemapsIndex || false,
    warnings: String(s.warnings || "0"),
    errors: String(s.errors || "0"),
    contents: s.contents?.map((c) => ({
      type: c.type || "",
      submitted: String(c.submitted || "0"),
      indexed: String(c.indexed || "0"),
    })),
  }));

  setCache(cacheKey, sitemaps);
  return sitemaps;
}

/* ── URL Inspection ──────────────────────────────── */

export interface InspectionResult {
  url: string;
  indexingState: string;
  lastCrawlTime?: string;
  crawlStatus?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  verdict?: string;
  mobileUsability?: string;
}

export async function inspectUrls(
  urls: string[]
): Promise<InspectionResult[]> {
  const auth = getAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const results: InspectionResult[] = [];
  const batch = urls.slice(0, 20); // Max 20 per load

  for (const url of batch) {
    try {
      const res = await searchconsole.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: url,
          siteUrl: SITE_URL,
        },
      });

      const r = res.data.inspectionResult;
      results.push({
        url,
        indexingState:
          r?.indexStatusResult?.coverageState || "UNKNOWN",
        lastCrawlTime: r?.indexStatusResult?.lastCrawlTime || undefined,
        crawlStatus: r?.indexStatusResult?.crawledAs || undefined,
        robotsTxtState: r?.indexStatusResult?.robotsTxtState || undefined,
        pageFetchState: r?.indexStatusResult?.pageFetchState || undefined,
        verdict: r?.indexStatusResult?.verdict || undefined,
        mobileUsability:
          r?.mobileUsabilityResult?.verdict || undefined,
      });
    } catch {
      results.push({
        url,
        indexingState: "ERROR",
        verdict: "INSPECTION_FAILED",
      });
    }
  }

  return results;
}
