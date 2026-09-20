import { SearchEngineProvider } from "../../core/provider.js";
import {
  SiteInfo,
  SearchAnalyticsQuery,
  AnalyticsResult,
  UrlInspectionResult,
  SitemapInfo,
} from "../../core/types.js";
import {
  isBingConfigured,
  getBingApiKey,
  getBingConfigurationGuide,
  formatBingError,
} from "./auth.js";
import { fetchWithTimeout, readBodyText, readJsonSafe } from "../../core/http.js";
import { getErrorMessage, withCode } from "../../core/errors.js";
import { asRecord } from "../../core/guards.js";
import {
  validateDateRange,
  buildSafeRegExp,
  clampRowLimit,
  clampStartRow,
  normalizeSitemapKey,
} from "../../core/validation.js";

const BING_API_BASE = "https://ssl.bing.com/webmaster/api.json";
const BING_MAX_ROWS = 5000;

async function bingFetch(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const apiKey: string = getBingApiKey();
  const url = new URL(`${BING_API_BASE}/${endpoint}`);
  url.searchParams.set("apikey", apiKey);

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "seo-webmaster-mcp/1.0.0",
      },
    });
  } catch (err: unknown) {
    throw new Error(`Bing Webmaster request failed for "${endpoint}": ${getErrorMessage(err)}`, {
      cause: err,
    });
  }

  if (!res.ok) {
    const body: string = await readBodyText(res);
    throw withCode(
      new Error(`Bing Webmaster API error (${res.status}): ${body || res.statusText}`),
      res.status,
    );
  }

  const json: unknown = await readJsonSafe(res);
  if (typeof json === "object" && json !== null && "d" in json) {
    return asRecord(json, "Bing response")["d"];
  }
  return json;
}

interface BingQueryRow {
  Query?: unknown;
  Page?: unknown;
  Clicks?: unknown;
  Impressions?: unknown;
  AvgClickPosition?: unknown;
  AvgImpressionPosition?: unknown;
}

type BingTextField = "Query" | "Page";

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rowText(row: BingQueryRow, field: BingTextField): string {
  const value: unknown = row[field];
  return typeof value === "string" ? value : String(value ?? "");
}

function applyTextFilter(
  rows: BingQueryRow[],
  field: BingTextField,
  filterValue: string,
): BingQueryRow[] {
  const filter: string = filterValue.trim();
  if (filter.length === 0) {
    throw new Error("Filter value is empty.");
  }
  if (filter.startsWith("!regex:")) {
    const re: RegExp = buildSafeRegExp(filter.slice(7), "Bing filter");
    return rows.filter((r: BingQueryRow) => !re.test(rowText(r, field)));
  }
  if (filter.startsWith("regex:")) {
    const re: RegExp = buildSafeRegExp(filter.slice(6), "Bing filter");
    return rows.filter((r: BingQueryRow) => re.test(rowText(r, field)));
  }
  if (filter.startsWith("exact:")) {
    const exact: string = filter.slice(6).trim().toLowerCase();
    if (exact.length === 0) {
      throw new Error('Invalid filter: "exact:" needs a non-empty value.');
    }
    return rows.filter((r: BingQueryRow) => rowText(r, field).toLowerCase() === exact);
  }
  if (filter.startsWith("!")) {
    const term: string = filter.slice(1).trim().toLowerCase();
    if (term.length === 0) {
      throw new Error('Invalid filter: "!" needs a non-empty value.');
    }
    return rows.filter((r: BingQueryRow) => !rowText(r, field).toLowerCase().includes(term));
  }
  const term: string = filter.toLowerCase();
  return rows.filter((r: BingQueryRow) => rowText(r, field).toLowerCase().includes(term));
}

export class BingWebmasterProvider implements SearchEngineProvider {
  readonly engine = "bing" as const;
  readonly displayName = "Bing Webmaster Tools";

  isConfigured(): boolean {
    return isBingConfigured();
  }

  getConfigurationGuide(): string {
    return getBingConfigurationGuide();
  }

  async listSites(): Promise<SiteInfo[]> {
    try {
      const data: unknown = await bingFetch("GetUserSites");
      const sites: unknown[] = Array.isArray(data) ? data : [];

      return sites.map((entry: unknown) => {
        const s: Record<string, unknown> = asRecord(entry, "Bing site entry");
        return {
          siteUrl: typeof s["Url"] === "string" ? s["Url"] : "",
          permissionLevel: typeof s["Role"] === "string" ? s["Role"] : "SiteOwner",
          engine: "bing" as const,
        };
      });
    } catch (err: unknown) {
      throw new Error(formatBingError(err), { cause: err });
    }
  }

  async queryAnalytics(query: SearchAnalyticsQuery): Promise<AnalyticsResult> {
    try {
      validateDateRange(query.startDate, query.endDate);
      const siteUrl: string = query.siteUrl.trim();
      if (siteUrl.length === 0) {
        throw new Error("siteUrl is empty.");
      }
      const data: unknown = await bingFetch("GetQueryStats", { siteUrl });
      const raw: unknown[] = Array.isArray(data) ? data : [];
      const rawRows: BingQueryRow[] = raw.filter(
        (entry: unknown): entry is BingQueryRow => typeof entry === "object" && entry !== null,
      );

      let filteredRows: BingQueryRow[] = rawRows;

      if (query.queryFilter) {
        filteredRows = applyTextFilter(filteredRows, "Query", query.queryFilter);
      }
      if (query.pageFilter) {
        filteredRows = applyTextFilter(filteredRows, "Page", query.pageFilter);
      }

      const effectiveLimit: number = clampRowLimit(query.rowLimit, BING_MAX_ROWS, 100);
      const startRow: number = clampStartRow(query.startRow);
      const paged: BingQueryRow[] = filteredRows.slice(startRow, startRow + effectiveLimit);

      let totalClicks = 0;
      let totalImpressions = 0;
      let weightedPositionSum = 0;

      const rows = paged.map((r: BingQueryRow) => {
        const clicks: number = toNumber(r.Clicks);
        const impressions: number = toNumber(r.Impressions);
        const posRaw: number = toNumber(r.AvgClickPosition) || toNumber(r.AvgImpressionPosition);
        const ctr: number = impressions > 0 ? clicks / impressions : 0;

        totalClicks += clicks;
        totalImpressions += impressions;
        weightedPositionSum += posRaw * impressions;

        return {
          keys: [typeof r.Query === "string" ? r.Query : "unknown"],
          clicks,
          impressions,
          ctr,
          position: posRaw,
        };
      });

      const overallCtr: string =
        totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + "%" : "0.00%";
      const overallPosition: string =
        totalImpressions > 0 ? (weightedPositionSum / totalImpressions).toFixed(1) : "0.0";

      const notes: string[] = [
        "Bing GetQueryStats does not support server-side date ranges, dimensions, country/device filters, or searchType; filtering is applied client-side to query/page text only.",
      ];
      if (query.countryFilter || query.deviceFilter || query.searchType || query.dataState) {
        notes.push("countryFilter, deviceFilter, searchType, and dataState are ignored for Bing.");
      }
      if (query.dimensions && query.dimensions.length > 0) {
        notes.push(
          `Requested dimensions [${query.dimensions.join(", ")}] are not supported; Bing returns query-level rows only.`,
        );
      }

      return {
        engine: "bing",
        siteUrl: query.siteUrl,
        startDate: query.startDate,
        endDate: query.endDate,
        columns: ["query"],
        summary: {
          totalClicks,
          totalImpressions,
          overallCtr,
          overallPosition,
        },
        rows,
        effectiveLimit,
        note: notes.join(" "),
      };
    } catch (err: unknown) {
      throw new Error(formatBingError(err), { cause: err });
    }
  }

  async inspectUrl(siteUrl: string, url: string): Promise<UrlInspectionResult> {
    try {
      const cleanSite: string = siteUrl.trim();
      const cleanUrl: string = url.trim();
      if (cleanSite.length === 0 || cleanUrl.length === 0) {
        throw new Error("siteUrl and inspectionUrl must be non-empty.");
      }
      let lastCrawl: string | undefined;
      try {
        const crawlData: unknown = await bingFetch("GetCrawlStats", { siteUrl: cleanSite });
        if (Array.isArray(crawlData) && crawlData.length > 0) {
          const first: Record<string, unknown> = asRecord(crawlData[0], "Bing crawl entry");
          if (typeof first["Date"] === "string") {
            lastCrawl = first["Date"];
          }
        }
      } catch {
        // Bing crawl stats are best-effort context only; inspection stays UNKNOWN without them.
        lastCrawl = undefined;
      }

      return {
        engine: "bing",
        inspectionUrl: cleanUrl,
        siteUrl: cleanSite,
        verdict: "UNKNOWN",
        coverageState:
          "UNKNOWN: Bing Webmaster API does not provide URL-level inspection. Use site crawl stats only as a coarse signal.",
        lastCrawlTime: lastCrawl,
        referringUrls: [],
        sitemaps: [],
      };
    } catch (err: unknown) {
      throw new Error(formatBingError(err), { cause: err });
    }
  }

  async listSitemaps(siteUrl: string): Promise<SitemapInfo[]> {
    try {
      const cleanSite: string = siteUrl.trim();
      if (cleanSite.length === 0) {
        throw new Error("siteUrl must be non-empty.");
      }
      const data: unknown = await bingFetch("GetFeeds", { siteUrl: cleanSite });
      const feeds: unknown[] = Array.isArray(data) ? data : [];

      return feeds.map((entry: unknown) => {
        const f: Record<string, unknown> = asRecord(entry, "Bing feed entry");
        const submitted: number = toNumber(f["SubmittedUrlCount"]);
        const indexed: number = toNumber(f["IndexedUrlCount"]);
        return {
          path: typeof f["Url"] === "string" ? f["Url"] : "",
          engine: "bing" as const,
          lastSubmitted:
            typeof f["LastSubmittedDate"] === "string" ? f["LastSubmittedDate"] : undefined,
          lastDownloaded:
            typeof f["LastCrawledDate"] === "string" ? f["LastCrawledDate"] : undefined,
          type: typeof f["FeedType"] === "string" ? f["FeedType"] : "Sitemap",
          errors: toNumber(f["CrawlErrorCount"]),
          warnings: 0,
          status: typeof f["Status"] === "string" ? f["Status"] : "Submitted",
          submittedUrls: submitted,
          indexedUrls: indexed,
          contents: [
            {
              type: "web",
              submitted,
              indexed,
            },
          ],
        };
      });
    } catch (err: unknown) {
      throw new Error(formatBingError(err), { cause: err });
    }
  }

  async getSitemap(siteUrl: string, feedpath: string): Promise<SitemapInfo> {
    const cleanFeed: string = feedpath.trim();
    if (cleanFeed.length === 0) {
      throw new Error("feedpath must be non-empty.");
    }
    const sitemaps: SitemapInfo[] = await this.listSitemaps(siteUrl);
    const target: string = normalizeSitemapKey(cleanFeed);
    const found: SitemapInfo | undefined = sitemaps.find(
      (s: SitemapInfo) => normalizeSitemapKey(s.path) === target,
    );
    if (!found) {
      throw new Error(
        `Sitemap feed "${cleanFeed}" not found in Bing Webmaster Tools for ${siteUrl.trim()}`,
      );
    }
    return found;
  }
}
