import { summarizeRows } from "../../core/analytics.js";
import { createTextMatcher, parseTextFilter } from "../../core/filters.js";
import { asRecordArray } from "../../core/guards.js";
import type { SearchEngineProvider } from "../../core/provider.js";
import type {
  AnalyticsResult,
  SearchAnalyticsQuery,
  SiteInfo,
  SitemapInfo,
  UrlInspectionResult,
} from "../../core/types.js";
import {
  clampRowLimit,
  clampStartRow,
  normalizeSitemapKey,
  requireText,
  validateDateRange,
} from "../../core/validation.js";
import { BING_SETUP_GUIDE, bingGet, isBingConfigured, withBingErrors } from "./auth.js";
import {
  aggregateRows,
  isInDateRange,
  latestCrawlDate,
  rowKey,
  toSiteInfo,
  toSitemapInfo,
} from "./mappers.js";

const BING_MAX_ROWS = 5000;
const DEFAULT_ROW_LIMIT = 100;

/** Bing returns one dimension per call: query stats or page stats. */
type BingMode = "query" | "page";

function resolveMode(query: SearchAnalyticsQuery): BingMode {
  const dimensions = query.dimensions ?? [];
  const wantsPages = dimensions.includes("page") && !dimensions.includes("query");
  const filtersPages = Boolean(query.pageFilter) && !query.queryFilter;
  return wantsPages || filtersPages ? "page" : "query";
}

/** Explains every requested option that Bing cannot honor. */
function buildNotes(query: SearchAnalyticsQuery, mode: BingMode): string[] {
  const otherDimensions = (query.dimensions ?? []).filter((dimension) => dimension !== mode);
  const rules: ReadonlyArray<readonly [boolean, string]> = [
    [
      mode === "page" && Boolean(query.queryFilter),
      "queryFilter was ignored because page mode was active.",
    ],
    [
      mode === "query" && Boolean(query.pageFilter),
      "pageFilter was ignored because query mode was active. Specify dimensions: ['page'] to query page stats.",
    ],
    [Boolean(query.countryFilter), "countryFilter is ignored for Bing."],
    [Boolean(query.deviceFilter), "deviceFilter is ignored for Bing."],
    [
      query.searchType !== undefined && query.searchType !== "web",
      `searchType '${query.searchType}' is not supported by Bing; web results returned.`,
    ],
    [
      query.dataState !== undefined && query.dataState !== "all",
      `dataState '${query.dataState}' is ignored for Bing.`,
    ],
    [
      otherDimensions.length > 0,
      `Bing returns single-dimension statistics (${mode}). Additional requested dimensions are not supported.`,
    ],
    [
      true,
      `Bing returns weekly bucketed statistics. Data was filtered client-side between ${query.startDate} and ${query.endDate} and aggregated per ${mode}.`,
    ],
  ];
  return rules.filter(([applies]) => applies).map(([, note]) => note);
}

function createRowFilter(
  query: SearchAnalyticsQuery,
  mode: BingMode,
): (row: Record<string, unknown>) => boolean {
  const rawFilter = mode === "page" ? query.pageFilter : query.queryFilter;
  const matches = rawFilter
    ? createTextMatcher(parseTextFilter(rawFilter, `${mode}Filter`))
    : (): boolean => true;
  return (row) => isInDateRange(row, query.startDate, query.endDate) && matches(rowKey(row));
}

/** The adapter for the Bing Webmaster JSON API. */
export class BingWebmasterProvider implements SearchEngineProvider {
  readonly engine = "bing" as const;
  readonly displayName = "Bing Webmaster Tools";
  readonly authMethod = "API Key (BING_WEBMASTER_API_KEY)";

  isConfigured(): boolean {
    return isBingConfigured();
  }

  getConfigurationGuide(): string {
    return BING_SETUP_GUIDE;
  }

  listSites(): Promise<SiteInfo[]> {
    return withBingErrors(async () => asRecordArray(await bingGet("GetUserSites")).map(toSiteInfo));
  }

  queryAnalytics(query: SearchAnalyticsQuery): Promise<AnalyticsResult> {
    return withBingErrors(async () => {
      validateDateRange(query.startDate, query.endDate);
      const siteUrl = requireText(query.siteUrl, "siteUrl");
      const mode = resolveMode(query);
      const endpoint = mode === "page" ? "GetPageStats" : "GetQueryStats";
      const keepRow = createRowFilter(query, mode);
      const rows = aggregateRows(
        asRecordArray(await bingGet(endpoint, { siteUrl })).filter(keepRow),
      );
      const effectiveLimit = clampRowLimit(query.rowLimit, BING_MAX_ROWS, DEFAULT_ROW_LIMIT);
      const startRow = clampStartRow(query.startRow);
      const paged = rows.slice(startRow, startRow + effectiveLimit);
      return {
        engine: this.engine,
        siteUrl: query.siteUrl,
        startDate: query.startDate,
        endDate: query.endDate,
        columns: [mode],
        summary: summarizeRows(paged),
        rows: paged,
        effectiveLimit,
        note: buildNotes(query, mode).join(" "),
      };
    });
  }

  /** Bing has no URL-level inspection. The result is UNKNOWN, with site-level crawl context. */
  inspectUrl(siteUrl: string, url: string): Promise<UrlInspectionResult> {
    return withBingErrors(async () => {
      if (!isBingConfigured()) {
        throw new Error(BING_SETUP_GUIDE);
      }
      const site = requireText(siteUrl, "siteUrl");
      const inspectionUrl = requireText(url, "inspectionUrl");
      const crawlStats = await bingGet("GetCrawlStats", { siteUrl: site }).catch(
        // Crawl stats are best-effort context. The inspection stays UNKNOWN without them.
        () => [],
      );
      return {
        engine: this.engine,
        inspectionUrl,
        siteUrl: site,
        verdict: "UNKNOWN",
        coverageState:
          "UNKNOWN: Bing Webmaster API does not provide URL-level inspection. Site crawl context is provided at property level.",
        siteLastCrawlTime: latestCrawlDate(asRecordArray(crawlStats)),
        referringUrls: [],
        sitemaps: [],
      };
    });
  }

  listSitemaps(siteUrl: string): Promise<SitemapInfo[]> {
    return withBingErrors(async () => {
      const site = requireText(siteUrl, "siteUrl");
      return asRecordArray(await bingGet("GetFeeds", { siteUrl: site })).map(toSitemapInfo);
    });
  }

  async getSitemap(siteUrl: string, feedpath: string): Promise<SitemapInfo> {
    const feed = requireText(feedpath, "feedpath");
    const target = normalizeSitemapKey(feed);
    const sitemaps = await this.listSitemaps(siteUrl);
    const found = sitemaps.find((sitemap) => normalizeSitemapKey(sitemap.path) === target);
    if (!found) {
      throw new Error(
        `Sitemap feed "${feed}" not found in Bing Webmaster Tools for ${siteUrl.trim()}`,
      );
    }
    return found;
  }
}
