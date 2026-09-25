import type { searchconsole_v1 } from "googleapis";
import { summarizeRows } from "../../core/analytics.js";
import { parseTextFilter, type FilterMode } from "../../core/filters.js";
import { compact } from "../../core/guards.js";
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
  normalizeDimensions,
  requireText,
  validateDateRange,
} from "../../core/validation.js";
import {
  GOOGLE_SETUP_GUIDE,
  getSearchConsoleClient,
  isGoogleConfigured,
  withGoogleErrors,
} from "./auth.js";
import { toAnalyticsRow, toInspectionResult, toSiteInfo, toSitemapInfo } from "./mappers.js";

type DimensionFilter = searchconsole_v1.Schema$ApiDimensionFilter;

const GOOGLE_MAX_ROWS = 25_000;
const DEFAULT_ROW_LIMIT = 100;
const COUNTRY_RE = /^[A-Z]{3}$/;

const OPERATORS: Readonly<Record<FilterMode, { include: string; exclude: string }>> = {
  contains: { include: "contains", exclude: "notContains" },
  equals: { include: "equals", exclude: "notEquals" },
  regex: { include: "includingRegex", exclude: "excludingRegex" },
};

function textFilter(dimension: "query" | "page", raw: string): DimensionFilter {
  const { mode, negate, expression } = parseTextFilter(raw, `${dimension}Filter`);
  const operators = OPERATORS[mode];
  return { dimension, operator: negate ? operators.exclude : operators.include, expression };
}

function countryFilter(raw: string): DimensionFilter {
  const country = raw.trim().toUpperCase();
  if (!COUNTRY_RE.test(country)) {
    throw new Error(`Invalid countryFilter "${raw}". Use ISO 3166-1 alpha-3 (e.g. USA, GBR).`);
  }
  return { dimension: "country", operator: "equals", expression: country };
}

function buildFilters(query: SearchAnalyticsQuery): DimensionFilter[] {
  return compact([
    query.queryFilter && textFilter("query", query.queryFilter),
    query.pageFilter && textFilter("page", query.pageFilter),
    query.countryFilter && countryFilter(query.countryFilter),
    query.deviceFilter && {
      dimension: "device",
      operator: "equals",
      expression: query.deviceFilter,
    },
  ]);
}

/** The adapter for the Google Search Console API (v1). */
export class GoogleSearchConsoleProvider implements SearchEngineProvider {
  readonly engine = "google" as const;
  readonly displayName = "Google Search Console";
  readonly authMethod = "Service Account JSON / ADC";

  isConfigured(): boolean {
    return isGoogleConfigured();
  }

  getConfigurationGuide(): string {
    return GOOGLE_SETUP_GUIDE;
  }

  listSites(): Promise<SiteInfo[]> {
    return withGoogleErrors(async () => {
      const res = await getSearchConsoleClient().sites.list();
      return (res.data.siteEntry ?? []).map(toSiteInfo);
    });
  }

  queryAnalytics(query: SearchAnalyticsQuery): Promise<AnalyticsResult> {
    return withGoogleErrors(async () => {
      validateDateRange(query.startDate, query.endDate);
      const siteUrl = requireText(query.siteUrl, "siteUrl");
      const dimensions = normalizeDimensions(query.dimensions);
      const filters = buildFilters(query);
      const effectiveLimit = clampRowLimit(query.rowLimit, GOOGLE_MAX_ROWS, DEFAULT_ROW_LIMIT);
      const res = await getSearchConsoleClient().searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: query.startDate.trim(),
          endDate: query.endDate.trim(),
          dimensions,
          rowLimit: effectiveLimit,
          startRow: clampStartRow(query.startRow),
          type: query.searchType ?? "web",
          dataState: query.dataState ?? "all",
          dimensionFilterGroups: filters.length > 0 ? [{ filters }] : undefined,
        },
      });
      const rows = (res.data.rows ?? []).map(toAnalyticsRow);
      return {
        engine: this.engine,
        siteUrl: query.siteUrl,
        startDate: query.startDate,
        endDate: query.endDate,
        columns: dimensions,
        summary: summarizeRows(rows),
        rows,
        effectiveLimit,
      };
    });
  }

  inspectUrl(siteUrl: string, url: string, languageCode = "en-US"): Promise<UrlInspectionResult> {
    return withGoogleErrors(async () => {
      const site = requireText(siteUrl, "siteUrl");
      const inspectionUrl = requireText(url, "inspectionUrl");
      const res = await getSearchConsoleClient().urlInspection.index.inspect({
        requestBody: { siteUrl: site, inspectionUrl, languageCode },
      });
      const result = res.data.inspectionResult;
      if (!result) {
        throw new Error(`No inspection result returned for "${inspectionUrl}"`);
      }
      return toInspectionResult(site, inspectionUrl, result);
    });
  }

  listSitemaps(siteUrl: string): Promise<SitemapInfo[]> {
    return withGoogleErrors(async () => {
      const site = requireText(siteUrl, "siteUrl");
      const res = await getSearchConsoleClient().sitemaps.list({ siteUrl: site });
      return (res.data.sitemap ?? []).map((sitemap) => toSitemapInfo(sitemap));
    });
  }

  getSitemap(siteUrl: string, feedpath: string): Promise<SitemapInfo> {
    return withGoogleErrors(async () => {
      const site = requireText(siteUrl, "siteUrl");
      const feed = requireText(feedpath, "feedpath");
      const res = await getSearchConsoleClient().sitemaps.get({ siteUrl: site, feedpath: feed });
      return toSitemapInfo(res.data, feed);
    });
  }
}
