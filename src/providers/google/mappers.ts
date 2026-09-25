import type { searchconsole_v1 } from "googleapis";
import { asFiniteNumber } from "../../core/guards.js";
import type {
  AnalyticsRow,
  MobileUsability,
  RichResults,
  SiteInfo,
  SitemapInfo,
  UrlInspectionResult,
} from "../../core/types.js";

type Nullable<T> = T | null | undefined;

// googleapis marks every field as `T | null | undefined`. Domain types use `T | undefined`.
// `||`, not `??`: the API can send "" for a field with no value.
function orUndefined<T extends string | readonly string[]>(value: Nullable<T>): T | undefined {
  return value || undefined;
}

function toCount(value: Nullable<string | number>): number {
  return asFiniteNumber(Number(value), 0);
}

export function toSiteInfo(entry: searchconsole_v1.Schema$WmxSite): SiteInfo {
  return {
    siteUrl: entry.siteUrl || "",
    permissionLevel: entry.permissionLevel || "unknown",
    engine: "google",
  };
}

export function toAnalyticsRow(row: searchconsole_v1.Schema$ApiDataRow): AnalyticsRow {
  return {
    keys: (row.keys ?? []).map(String),
    clicks: asFiniteNumber(row.clicks, 0),
    impressions: asFiniteNumber(row.impressions, 0),
    ctr: asFiniteNumber(row.ctr, 0),
    position: asFiniteNumber(row.position, 0),
  };
}

export function toSitemapInfo(
  sitemap: searchconsole_v1.Schema$WmxSitemap,
  fallbackPath = "",
): SitemapInfo {
  const errors = toCount(sitemap.errors);
  const status = errors > 0 ? "Has errors" : "Success";
  return {
    path: sitemap.path ?? fallbackPath,
    engine: "google",
    lastSubmitted: orUndefined(sitemap.lastSubmitted),
    lastDownloaded: orUndefined(sitemap.lastDownloaded),
    type: sitemap.isSitemapsIndex ? "Sitemap Index" : "Standard Sitemap",
    errors,
    warnings: toCount(sitemap.warnings),
    status: sitemap.isPending ? "Pending" : status,
    contents: (sitemap.contents ?? []).map((content) => ({
      type: content.type || "web",
      submitted: toCount(content.submitted),
      indexed: toCount(content.indexed),
    })),
  };
}

function toMobileUsability(
  result: Nullable<searchconsole_v1.Schema$MobileUsabilityInspectionResult>,
): MobileUsability | undefined {
  if (!result) {
    return undefined;
  }
  return {
    verdict: result.verdict || "UNKNOWN",
    issues: (result.issues ?? []).map((issue) => ({
      issueType: issue.issueType || "UsabilityIssue",
      severity: orUndefined(issue.severity),
      message: orUndefined(issue.message),
    })),
  };
}

function toRichResults(
  result: Nullable<searchconsole_v1.Schema$RichResultsInspectionResult>,
): RichResults | undefined {
  if (!result) {
    return undefined;
  }
  return {
    verdict: result.verdict || "UNKNOWN",
    detectedItems: (result.detectedItems ?? []).map((group) => ({
      type: group.richResultType || "RichResult",
      items: (group.items ?? []).map((item) => ({
        name: orUndefined(item.name),
        issues: (item.issues ?? []).map((issue) => ({
          severity: orUndefined(issue.severity),
          message: orUndefined(issue.issueMessage),
        })),
      })),
    })),
  };
}

export function toInspectionResult(
  siteUrl: string,
  inspectionUrl: string,
  result: searchconsole_v1.Schema$UrlInspectionResult,
): UrlInspectionResult {
  const index = result.indexStatusResult ?? {};
  return {
    engine: "google",
    inspectionUrl,
    siteUrl,
    verdict: index.verdict || "UNKNOWN",
    coverageState: orUndefined(index.coverageState),
    indexingState: orUndefined(index.indexingState),
    lastCrawlTime: orUndefined(index.lastCrawlTime),
    crawledAs: orUndefined(index.crawledAs),
    robotsTxtState: orUndefined(index.robotsTxtState),
    pageFetchState: orUndefined(index.pageFetchState),
    userCanonical: orUndefined(index.userCanonical),
    googleCanonical: orUndefined(index.googleCanonical),
    referringUrls: orUndefined(index.referringUrls),
    sitemaps: orUndefined(index.sitemap),
    mobileUsability: toMobileUsability(result.mobileUsabilityResult),
    richResults: toRichResults(result.richResultsResult),
  };
}
