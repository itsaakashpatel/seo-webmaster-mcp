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

const VALID_DIMENSIONS = [
  "query",
  "page",
  "country",
  "device",
  "searchAppearance",
  "date",
] as const;

function parseFilter(
  dimension: string,
  filterValue: string
): { dimension: string; operator: string; expression: string } {
  const trimmed = filterValue.trim();

  if (trimmed.startsWith("!regex:")) {
    return {
      dimension,
      operator: "excludingRegex",
      expression: trimmed.slice(7),
    };
  }
  if (trimmed.startsWith("regex:")) {
    return {
      dimension,
      operator: "includingRegex",
      expression: trimmed.slice(6),
    };
  }
  if (trimmed.startsWith("exact:")) {
    return {
      dimension,
      operator: "equals",
      expression: trimmed.slice(6),
    };
  }
  if (trimmed.startsWith("!exact:") || trimmed.startsWith("!=")) {
    const expr = trimmed.startsWith("!exact:") ? trimmed.slice(7) : trimmed.slice(2);
    return {
      dimension,
      operator: "notEquals",
      expression: expr,
    };
  }
  if (trimmed.startsWith("!")) {
    return {
      dimension,
      operator: "notContains",
      expression: trimmed.slice(1),
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
        engine: "google",
      }));
    } catch (err: any) {
      throw new Error(formatGoogleError(err));
    }
  }

  async queryAnalytics(query: SearchAnalyticsQuery): Promise<AnalyticsResult> {
    try {
      const client = getGoogleSearchConsoleClient();

      const dimensionList = query.dimensions
        ? query.dimensions.filter((d) =>
            VALID_DIMENSIONS.includes(d as (typeof VALID_DIMENSIONS)[number])
          )
        : ["query"];

      if (dimensionList.length === 0) {
        dimensionList.push("query");
      }

      const filters: any[] = [];
      if (query.queryFilter) {
        filters.push(parseFilter("query", query.queryFilter));
      }
      if (query.pageFilter) {
        filters.push(parseFilter("page", query.pageFilter));
      }
      if (query.countryFilter) {
        filters.push({
          dimension: "country",
          operator: "equals",
          expression: query.countryFilter.toUpperCase().trim(),
        });
      }
      if (query.deviceFilter) {
        filters.push({
          dimension: "device",
          operator: "equals",
          expression: query.deviceFilter,
        });
      }

      const effectiveLimit = Math.min(Math.max(query.rowLimit || 100, 1), 25000);

      const requestBody: any = {
        startDate: query.startDate,
        endDate: query.endDate,
        dimensions: dimensionList,
        rowLimit: effectiveLimit,
        startRow: query.startRow || 0,
        type: query.searchType || "web",
        dataState: query.dataState || "all",
      };

      if (filters.length > 0) {
        requestBody.dimensionFilterGroups = [{ filters }];
      }

      const res = await client.searchanalytics.query({
        siteUrl: query.siteUrl,
        requestBody,
      });

      const rawRows = res.data.rows || [];

      let totalClicks = 0;
      let totalImpressions = 0;
      let weightedPositionSum = 0;

      const rows = rawRows.map((r: any) => {
        const clicks = r.clicks || 0;
        const impressions = r.impressions || 0;
        const position = r.position || 0;
        const ctr = r.ctr || 0;

        totalClicks += clicks;
        totalImpressions += impressions;
        weightedPositionSum += position * impressions;

        return {
          keys: (r.keys || []).map(String),
          clicks,
          impressions,
          ctr,
          position,
        };
      });

      const overallCtr =
        totalImpressions > 0
          ? ((totalClicks / totalImpressions) * 100).toFixed(2) + "%"
          : "0.00%";
      const overallPosition =
        totalImpressions > 0
          ? (weightedPositionSum / totalImpressions).toFixed(1)
          : "0.0";

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
      };
    } catch (err: any) {
      throw new Error(formatGoogleError(err));
    }
  }

  async inspectUrl(
    siteUrl: string,
    inspectionUrl: string,
    languageCode = "en-US"
  ): Promise<UrlInspectionResult> {
    try {
      const client = getGoogleSearchConsoleClient();
      const res = await client.urlInspection.index.inspect({
        requestBody: {
          siteUrl,
          inspectionUrl,
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
        inspectionUrl,
        siteUrl,
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
    } catch (err: any) {
      throw new Error(formatGoogleError(err));
    }
  }

  async listSitemaps(siteUrl: string): Promise<SitemapInfo[]> {
    try {
      const client = getGoogleSearchConsoleClient();
      const res = await client.sitemaps.list({ siteUrl });
      const sitemaps = res.data.sitemap || [];

      return sitemaps.map((sm: any) => ({
        path: sm.path || "",
        engine: "google",
        lastSubmitted: sm.lastSubmitted || undefined,
        lastDownloaded: sm.lastDownloaded || undefined,
        type: sm.isSitemapsIndex ? "Sitemap Index" : "Standard Sitemap",
        errors: Number(sm.errors) || 0,
        warnings: Number(sm.warnings) || 0,
        status: sm.isPending ? "Pending" : (Number(sm.errors) || 0) > 0 ? "Has errors" : "Success",
        contents: (sm.contents || []).map((c: any) => ({
          type: c.type || "web",
          submitted: Number(c.submitted) || 0,
          indexed: Number(c.indexed) || 0,
        })),
      }));
    } catch (err: any) {
      throw new Error(formatGoogleError(err));
    }
  }

  async getSitemap(siteUrl: string, feedpath: string): Promise<SitemapInfo> {
    try {
      const client = getGoogleSearchConsoleClient();
      const res = await client.sitemaps.get({ siteUrl, feedpath });
      const sm = res.data;

      const errCount = Number(sm.errors) || 0;
      const warnCount = Number(sm.warnings) || 0;

      return {
        path: sm.path || feedpath,
        engine: "google",
        lastSubmitted: sm.lastSubmitted || undefined,
        lastDownloaded: sm.lastDownloaded || undefined,
        type: sm.isSitemapsIndex ? "Sitemap Index" : "Standard Sitemap",
        errors: errCount,
        warnings: warnCount,
        status: sm.isPending ? "Pending" : errCount > 0 ? "Has errors" : "Success",
        contents: (sm.contents || []).map((c: any) => ({
          type: c.type || "web",
          submitted: Number(c.submitted) || 0,
          indexed: Number(c.indexed) || 0,
        })),
      };
    } catch (err: any) {
      throw new Error(formatGoogleError(err));
    }
  }
}
