import { SearchEngineProvider } from "../../core/provider.js";
import {
  SiteInfo,
  SearchAnalyticsQuery,
  AnalyticsResult,
  UrlInspectionResult,
  SitemapInfo,
} from "../../core/types.js";
import {
  getGoogleSearchConsoleClient,
  isGoogleConfigured,
  getGoogleConfigurationGuide,
  formatGoogleError,
} from "./auth.js";

import {
  normalizeDimensions,
  validateDateRange,
  clampRowLimit,
  clampStartRow,
  buildSafeRegExp,
} from "../../core/validation.js";
import { asRecord } from "../../core/guards.js";

const VALID_DIMENSIONS = [
  "query",
  "page",
  "country",
  "device",
  "searchAppearance",
  "date",
] as const;

export type ValidDimension = (typeof VALID_DIMENSIONS)[number];

function isValidDimension(value: string): value is ValidDimension {
  return (VALID_DIMENSIONS as readonly string[]).includes(value);
}

export function normalizeGoogleDimensions(input: readonly string[] | undefined): ValidDimension[] {
  return normalizeDimensions(input).filter(isValidDimension);
}

function parseFilter(
  dimension: string,
  filterValue: string,
): { dimension: string; operator: string; expression: string } {
  const trimmed: string = filterValue.trim();
  if (trimmed.length === 0) {
    throw new Error(`Invalid filter for "${dimension}": value is empty.`);
  }

  const getExpr = (prefixLen: number, label: string): string => {
    const expr: string = trimmed.slice(prefixLen).trim();
    if (expr.length === 0) {
      throw new Error(`Invalid filter for "${dimension}": "${label}" needs a non-empty pattern.`);
    }
    if (label.includes("regex")) {
      buildSafeRegExp(expr, `filter for "${dimension}"`);
    }
    return expr;
  };

  if (trimmed.startsWith("!regex:")) {
    return {
      dimension,
      operator: "excludingRegex",
      expression: getExpr(7, "regex"),
    };
  }
  if (trimmed.startsWith("regex:")) {
    return {
      dimension,
      operator: "includingRegex",
      expression: getExpr(6, "regex"),
    };
  }
  if (trimmed.startsWith("exact:")) {
    return {
      dimension,
      operator: "equals",
      expression: getExpr(6, "exact"),
    };
  }
  if (trimmed.startsWith("!exact:") || trimmed.startsWith("!=")) {
    const prefixLen: number = trimmed.startsWith("!exact:") ? 7 : 2;
    return {
      dimension,
      operator: "notEquals",
      expression: getExpr(prefixLen, "not-equals"),
    };
  }
  if (trimmed.startsWith("!")) {
    return {
      dimension,
      operator: "notContains",
      expression: getExpr(1, "not-contains"),
    };
  }

  return {
    dimension,
    operator: "contains",
    expression: trimmed,
  };
}

export class GoogleSearchConsoleProvider implements SearchEngineProvider {
  readonly engine = "google" as const;
  readonly displayName = "Google Search Console";

  isConfigured(): boolean {
    return isGoogleConfigured();
  }

  getConfigurationGuide(): string {
    return getGoogleConfigurationGuide();
  }

  async listSites(): Promise<SiteInfo[]> {
    try {
      const client = getGoogleSearchConsoleClient();
      const res = await client.sites.list();
      const sites = res.data.siteEntry || [];

      return sites.map((s) => ({
        siteUrl: s.siteUrl || "",
        permissionLevel: s.permissionLevel || "unknown",
        engine: "google" as const,
      }));
    } catch (err: unknown) {
      throw new Error(formatGoogleError(err), { cause: err });
    }
  }

  async queryAnalytics(query: SearchAnalyticsQuery): Promise<AnalyticsResult> {
    try {
      validateDateRange(query.startDate, query.endDate);
      const siteUrl: string = query.siteUrl.trim();
      if (siteUrl.length === 0) {
        throw new Error("siteUrl is empty.");
      }
      const client = getGoogleSearchConsoleClient();

      const dimensionList: string[] = normalizeGoogleDimensions(query.dimensions);

      const filters: Array<Record<string, string>> = [];
      if (query.queryFilter) {
        filters.push(parseFilter("query", query.queryFilter));
      }
      if (query.pageFilter) {
        filters.push(parseFilter("page", query.pageFilter));
      }
      if (query.countryFilter) {
        const country: string = query.countryFilter.trim().toUpperCase();
        if (!/^[A-Z]{3}$/.test(country)) {
          throw new Error(
            `Invalid countryFilter "${query.countryFilter}". Use ISO 3166-1 alpha-3 (e.g. USA, GBR).`,
          );
        }
        filters.push({
          dimension: "country",
          operator: "equals",
          expression: country,
        });
      }
      if (query.deviceFilter) {
        filters.push({
          dimension: "device",
          operator: "equals",
          expression: query.deviceFilter,
        });
      }

      const effectiveLimit: number = clampRowLimit(query.rowLimit, 25000, 100);
      const startRow: number = clampStartRow(query.startRow);

      const res = await client.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate: query.startDate.trim(),
          endDate: query.endDate.trim(),
          dimensions: dimensionList,
          rowLimit: effectiveLimit,
          startRow,
          type: query.searchType || "web",
          dataState: query.dataState || "all",
          dimensionFilterGroups: filters.length > 0 ? [{ filters }] : undefined,
        },
      });

      const rawRows: unknown[] = Array.isArray(res.data.rows) ? res.data.rows : [];

      let totalClicks = 0;
      let totalImpressions = 0;
      let weightedPositionSum = 0;

      const rows = rawRows.map((row: unknown) => {
        const r: Record<string, unknown> = asRecord(row, "Search Analytics row");
        const clicks: number =
          typeof r["clicks"] === "number" && Number.isFinite(r["clicks"]) ? r["clicks"] : 0;
        const impressions: number =
          typeof r["impressions"] === "number" && Number.isFinite(r["impressions"])
            ? r["impressions"]
            : 0;
        const position: number =
          typeof r["position"] === "number" && Number.isFinite(r["position"]) ? r["position"] : 0;
        const ctr: number =
          typeof r["ctr"] === "number" && Number.isFinite(r["ctr"]) ? r["ctr"] : 0;

        totalClicks += clicks;
        totalImpressions += impressions;
        weightedPositionSum += position * impressions;

        const keysRaw: unknown = r["keys"];
        return {
          keys: Array.isArray(keysRaw) ? keysRaw.map(String) : [],
          clicks,
          impressions,
          ctr,
          position,
        };
      });

      const overallCtr =
        totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + "%" : "0.00%";
      const overallPosition =
        totalImpressions > 0 ? (weightedPositionSum / totalImpressions).toFixed(1) : "0.0";

      return {
        engine: "google",
        siteUrl: query.siteUrl,
        startDate: query.startDate,
        endDate: query.endDate,
        columns: dimensionList,
        summary: {
          totalClicks,
          totalImpressions,
          overallCtr,
          overallPosition,
        },
        rows,
        effectiveLimit,
      };
    } catch (err: unknown) {
      throw new Error(formatGoogleError(err), { cause: err });
    }
  }

  async inspectUrl(
    siteUrl: string,
    inspectionUrl: string,
    languageCode = "en-US",
  ): Promise<UrlInspectionResult> {
    try {
      const cleanSite: string = siteUrl.trim();
      const cleanUrl: string = inspectionUrl.trim();
      if (cleanSite.length === 0 || cleanUrl.length === 0) {
        throw new Error("siteUrl and inspectionUrl must be non-empty.");
      }
      const client = getGoogleSearchConsoleClient();
      const res = await client.urlInspection.index.inspect({
        requestBody: {
          siteUrl: cleanSite,
          inspectionUrl: cleanUrl,
          languageCode,
        },
      });

      const result = res.data.inspectionResult;
      if (!result) {
        throw new Error(`No inspection result returned for "${inspectionUrl}"`);
      }

      const idx = result.indexStatusResult;
      const mob = result.mobileUsabilityResult;
      const rich = result.richResultsResult;

      return {
        engine: "google",
        inspectionUrl: cleanUrl,
        siteUrl: cleanSite,
        verdict: idx?.verdict || "UNKNOWN",
        coverageState: idx?.coverageState || undefined,
        indexingState: idx?.indexingState || undefined,
        lastCrawlTime: idx?.lastCrawlTime || undefined,
        crawledAs: idx?.crawledAs || undefined,
        robotsTxtState: idx?.robotsTxtState || undefined,
        pageFetchState: idx?.pageFetchState || undefined,
        userCanonical: idx?.userCanonical || undefined,
        googleCanonical: idx?.googleCanonical || undefined,
        referringUrls: idx?.referringUrls || undefined,
        sitemaps: idx?.sitemap || undefined,
        mobileUsability: mob
          ? {
              verdict: mob.verdict || "UNKNOWN",
              issues: (mob.issues || []).map((i) => ({
                issueType: i.issueType || "UsabilityIssue",
                severity: i.severity || undefined,
                message: i.message || undefined,
              })),
            }
          : undefined,
        richResults: rich
          ? {
              verdict: rich.verdict || "UNKNOWN",
              detectedItems: (rich.detectedItems || []).map((d) => ({
                type: d.richResultType || "RichResult",
                items: (d.items || []).map((item) => ({
                  name: item.name || undefined,
                  issues: (item.issues || []).map((iss) => ({
                    severity: iss.severity || undefined,
                    message: iss.issueMessage || undefined,
                  })),
                })),
              })),
            }
          : undefined,
      };
    } catch (err: unknown) {
      throw new Error(formatGoogleError(err), { cause: err });
    }
  }

  async listSitemaps(siteUrl: string): Promise<SitemapInfo[]> {
    try {
      const cleanSite: string = siteUrl.trim();
      if (cleanSite.length === 0) {
        throw new Error("siteUrl must be non-empty.");
      }
      const client = getGoogleSearchConsoleClient();
      const res = await client.sitemaps.list({ siteUrl: cleanSite });
      const sitemaps = res.data.sitemap || [];

      return sitemaps.map((sm) => ({
        path: sm.path || "",
        engine: "google" as const,
        lastSubmitted: sm.lastSubmitted || undefined,
        lastDownloaded: sm.lastDownloaded || undefined,
        type: sm.isSitemapsIndex ? "Sitemap Index" : "Standard Sitemap",
        errors: Number(sm.errors) || 0,
        warnings: Number(sm.warnings) || 0,
        status: sm.isPending ? "Pending" : (Number(sm.errors) || 0) > 0 ? "Has errors" : "Success",
        contents: (sm.contents || []).map((c) => ({
          type: c.type || "web",
          submitted: Number(c.submitted) || 0,
          indexed: Number(c.indexed) || 0,
        })),
      }));
    } catch (err: unknown) {
      throw new Error(formatGoogleError(err), { cause: err });
    }
  }

  async getSitemap(siteUrl: string, feedpath: string): Promise<SitemapInfo> {
    try {
      const cleanSite: string = siteUrl.trim();
      const cleanFeed: string = feedpath.trim();
      if (cleanSite.length === 0 || cleanFeed.length === 0) {
        throw new Error("siteUrl and feedpath must be non-empty.");
      }
      const client = getGoogleSearchConsoleClient();
      const res = await client.sitemaps.get({ siteUrl: cleanSite, feedpath: cleanFeed });
      const sm = res.data;

      const errCount = Number(sm.errors) || 0;
      const warnCount = Number(sm.warnings) || 0;

      return {
        path: sm.path || cleanFeed,
        engine: "google" as const,
        lastSubmitted: sm.lastSubmitted || undefined,
        lastDownloaded: sm.lastDownloaded || undefined,
        type: sm.isSitemapsIndex ? "Sitemap Index" : "Standard Sitemap",
        errors: errCount,
        warnings: warnCount,
        status: sm.isPending ? "Pending" : errCount > 0 ? "Has errors" : "Success",
        contents: (sm.contents || []).map((c) => ({
          type: c.type || "web",
          submitted: Number(c.submitted) || 0,
          indexed: Number(c.indexed) || 0,
        })),
      };
    } catch (err: unknown) {
      throw new Error(formatGoogleError(err), { cause: err });
    }
  }
}
