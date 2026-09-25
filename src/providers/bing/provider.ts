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
  parseBingDate,
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
  Date?: unknown;
}

type BingTextField = "Query";

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
      const requestedDimensions: string[] = query.dimensions
        ? query.dimensions.map((d: string) => d.toLowerCase())
        : [];
      const isPageMode: boolean =
        (requestedDimensions.includes("page") && !requestedDimensions.includes("query")) ||
        Boolean(query.pageFilter && !query.queryFilter);

      const endpoint: string = isPageMode ? "GetPageStats" : "GetQueryStats";
      const data: unknown = await bingFetch(endpoint, { siteUrl });
      const raw: unknown[] = Array.isArray(data) ? data : [];
      const rawRows: BingQueryRow[] = raw.filter(
        (entry: unknown): entry is BingQueryRow => typeof entry === "object" && entry !== null,
      );

      // Filter rows client-side by date if Bing Date is present
      const dateFilteredRows: BingQueryRow[] = rawRows.filter((r: BingQueryRow) => {
        const iso: string | undefined = parseBingDate(r.Date);
        if (iso) {
          const dateStr: string = iso.slice(0, 10);
          return dateStr >= query.startDate && dateStr <= query.endDate;
        }
        return true;
      });

      let textFilteredRows: BingQueryRow[] = dateFilteredRows;
      if (isPageMode) {
        if (query.pageFilter) {
          textFilteredRows = applyTextFilter(textFilteredRows, "Query", query.pageFilter);
        }
      } else {
        if (query.queryFilter) {
          textFilteredRows = applyTextFilter(textFilteredRows, "Query", query.queryFilter);
        }
      }

      // Aggregate multi-week rows by query/page key
      interface AggregatedItem {
        key: string;
        clicks: number;
        impressions: number;
        weightedPositionSum: number;
      }
      const aggregatedMap = new Map<string, AggregatedItem>();

      for (const r of textFilteredRows) {
        const key: string = typeof r.Query === "string" ? r.Query : "unknown";
        const clicks: number = toNumber(r.Clicks);
        const impressions: number = toNumber(r.Impressions);
        const posRaw: number = toNumber(r.AvgClickPosition) || toNumber(r.AvgImpressionPosition);

        const existing = aggregatedMap.get(key);
        if (existing) {
          existing.clicks += clicks;
          existing.impressions += impressions;
          existing.weightedPositionSum += posRaw * impressions;
        } else {
          aggregatedMap.set(key, {
            key,
            clicks,
            impressions,
            weightedPositionSum: posRaw * impressions,
          });
        }
      }

      const allRows = Array.from(aggregatedMap.values()).map((item) => {
        const ctr: number = item.impressions > 0 ? item.clicks / item.impressions : 0;
        const position: number =
          item.impressions > 0 ? item.weightedPositionSum / item.impressions : 0;
        return {
          keys: [item.key],
          clicks: item.clicks,
          impressions: item.impressions,
          ctr,
          position,
        };
      });

      // Sort by clicks descending, then impressions descending
      allRows.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

      const effectiveLimit: number = clampRowLimit(query.rowLimit, BING_MAX_ROWS, 100);
      const startRow: number = clampStartRow(query.startRow);
      const paged = allRows.slice(startRow, startRow + effectiveLimit);

      let totalClicks = 0;
      let totalImpressions = 0;
      let weightedPositionSum = 0;

      for (const r of paged) {
        totalClicks += r.clicks;
        totalImpressions += r.impressions;
        weightedPositionSum += r.position * r.impressions;
      }

      const overallCtr: string =
        totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + "%" : "0.00%";
      const overallPosition: string =
        totalImpressions > 0 ? (weightedPositionSum / totalImpressions).toFixed(1) : "0.0";

      const notes: string[] = [];
      if (isPageMode && query.queryFilter) {
        notes.push("queryFilter was ignored because page mode was active.");
      }
      if (!isPageMode && query.pageFilter) {
        notes.push(
          "pageFilter was ignored because query mode was active. Specify dimensions: ['page'] to query page stats.",
        );
      }
      if (query.countryFilter) {
        notes.push("countryFilter is ignored for Bing.");
      }
      if (query.deviceFilter) {
        notes.push("deviceFilter is ignored for Bing.");
      }
      if (query.searchType && query.searchType !== "web") {
        notes.push(
          `searchType '${query.searchType}' is not supported by Bing; web results returned.`,
        );
      }
      if (query.dataState && query.dataState !== "all") {
        notes.push(`dataState '${query.dataState}' is ignored for Bing.`);
      }
      if (
        requestedDimensions.length > 1 ||
        (isPageMode
          ? !requestedDimensions.includes("page")
          : requestedDimensions.some((d: string) => d !== "query"))
      ) {
        notes.push(
          `Bing returns single-dimension statistics (${isPageMode ? "page" : "query"}). Additional requested dimensions are not supported.`,
        );
      }
      notes.push(
        `Bing returns weekly bucketed statistics. Data was filtered client-side between ${query.startDate} and ${query.endDate} and aggregated per ${isPageMode ? "page" : "query"}.`,
      );

      return {
        engine: "bing",
        siteUrl: query.siteUrl,
        startDate: query.startDate,
        endDate: query.endDate,
        columns: [isPageMode ? "page" : "query"],
        summary: {
          totalClicks,
          totalImpressions,
          overallCtr,
          overallPosition,
        },
        rows: paged,
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
      let siteLastCrawl: string | undefined;
      try {
        const crawlData: unknown = await bingFetch("GetCrawlStats", { siteUrl: cleanSite });
        if (Array.isArray(crawlData) && crawlData.length > 0) {
          const datedEntries = crawlData
            .map((entry: unknown) => {
              const rec = asRecord(entry, "Bing crawl entry");
              const parsedIso: string | undefined = parseBingDate(rec["Date"]);
              const ms: number = parsedIso ? Date.parse(parsedIso) : 0;
              return { parsedIso, ms };
            })
            .filter((e): e is { parsedIso: string; ms: number } => Boolean(e.parsedIso));

          datedEntries.sort((a, b) => b.ms - a.ms);
          siteLastCrawl = datedEntries[0]?.parsedIso;
        }
      } catch {
        // Bing crawl stats are best-effort context only; inspection stays UNKNOWN without them.
        siteLastCrawl = undefined;
      }

      return {
        engine: "bing",
        inspectionUrl: cleanUrl,
        siteUrl: cleanSite,
        verdict: "UNKNOWN",
        coverageState:
          "UNKNOWN: Bing Webmaster API does not provide URL-level inspection. Site crawl context is provided at property level.",
        lastCrawlTime: undefined,
        siteLastCrawlTime: siteLastCrawl,
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
        const submittedCount: number | undefined =
          typeof f["UrlCount"] === "number" && Number.isFinite(f["UrlCount"])
            ? f["UrlCount"]
            : undefined;
        const lastSubmitted: string | undefined = parseBingDate(f["Submitted"]);
        const lastDownloaded: string | undefined = parseBingDate(f["LastCrawled"]);
        const feedType: string = typeof f["Type"] === "string" ? f["Type"] : "Sitemap";
        const status: string = typeof f["Status"] === "string" ? f["Status"] : "Submitted";

        return {
          path: typeof f["Url"] === "string" ? f["Url"] : "",
          engine: "bing" as const,
          lastSubmitted,
          lastDownloaded,
          type: feedType,
          errors: undefined,
          warnings: undefined,
          status,
          submittedUrls: submittedCount,
          indexedUrls: undefined,
          contents: undefined,
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
