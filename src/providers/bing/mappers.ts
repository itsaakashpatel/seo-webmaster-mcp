import { ratio } from "../../core/analytics.js";
import { asFiniteNumber, asOptionalNumber, asString, isPresent } from "../../core/guards.js";
import type { AnalyticsRow, SiteInfo, SitemapInfo } from "../../core/types.js";

type BingRecord = Record<string, unknown>;

// WCF JSON date, for example "/Date(1690000000000-0700)/". The offset does not change the instant.
const WCF_DATE_RE = /^\/?Date\(([+-]?\d+)(?:[+-]\d{4})?\)\/?$/i;

function toIsoString(epochMs: number): string | undefined {
  const date = new Date(epochMs);
  // An out-of-range epoch gives an Invalid Date, and toISOString() would throw.
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Converts a Bing date (WCF string, ISO string, or epoch number) to an ISO string. */
export function parseBingDate(raw: unknown): string | undefined {
  if (typeof raw === "number") {
    return toIsoString(raw);
  }
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length === 0) {
    return undefined;
  }
  const wcf = WCF_DATE_RE.exec(text);
  return toIsoString(wcf?.[1] ? Number(wcf[1]) : Date.parse(text));
}

export function toSiteInfo(site: BingRecord): SiteInfo {
  return {
    siteUrl: asString(site.Url, ""),
    permissionLevel: asString(site.Role, "SiteOwner"),
    engine: "bing",
  };
}

/**
 * Maps a Bing `Feed`. Bing supplies no indexed, error, or warning counts, so those fields stay
 * `undefined` instead of a false 0.
 */
export function toSitemapInfo(feed: BingRecord): SitemapInfo {
  return {
    path: asString(feed.Url, ""),
    engine: "bing",
    lastSubmitted: parseBingDate(feed.Submitted),
    lastDownloaded: parseBingDate(feed.LastCrawled),
    type: asString(feed.Type, "Sitemap"),
    status: asString(feed.Status, "Submitted"),
    submittedUrls: asOptionalNumber(feed.UrlCount),
  };
}

/** Bing sends -1 when it has no position. Prefer the impression position, then the click one. */
function toPosition(row: BingRecord): number {
  const candidates = [row.AvgImpressionPosition, row.AvgClickPosition].map((value) =>
    asFiniteNumber(value, 0),
  );
  return candidates.find((position) => position > 0) ?? 0;
}

interface Totals {
  readonly clicks: number;
  readonly impressions: number;
  readonly weightedPosition: number;
}

function toAggregateRow(key: string, group: readonly BingRecord[]): AnalyticsRow {
  const totals = group.reduce<Totals>(
    (acc, row) => {
      const impressions = asFiniteNumber(row.Impressions, 0);
      return {
        clicks: acc.clicks + asFiniteNumber(row.Clicks, 0),
        impressions: acc.impressions + impressions,
        weightedPosition: acc.weightedPosition + toPosition(row) * impressions,
      };
    },
    { clicks: 0, impressions: 0, weightedPosition: 0 },
  );
  return {
    keys: [key],
    clicks: totals.clicks,
    impressions: totals.impressions,
    ctr: ratio(totals.clicks, totals.impressions),
    position: ratio(totals.weightedPosition, totals.impressions),
  };
}

export function rowKey(row: BingRecord): string {
  return typeof row.Query === "number" ? String(row.Query) : asString(row.Query, "unknown");
}

/** Bing returns one row per key per week. Merge them into one row per key, top clicks first. */
export function aggregateRows(rows: readonly BingRecord[]): AnalyticsRow[] {
  return [...Map.groupBy(rows, rowKey)]
    .map(([key, group]) => toAggregateRow(key, group))
    .toSorted((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

/** Keeps rows whose weekly bucket date is inside the range. Rows without a date are kept. */
export function isInDateRange(row: BingRecord, startDate: string, endDate: string): boolean {
  const day = parseBingDate(row.Date)?.slice(0, 10);
  return day === undefined || (day >= startDate && day <= endDate);
}

/** Returns the newest crawl date in a `GetCrawlStats` response. */
export function latestCrawlDate(entries: readonly BingRecord[]): string | undefined {
  return entries
    .map((entry) => parseBingDate(entry.Date))
    .filter(isPresent)
    .toSorted()
    .at(-1);
}
