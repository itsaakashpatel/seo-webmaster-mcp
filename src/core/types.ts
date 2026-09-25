export const QUERY_ENGINES = ["google", "bing"] as const;
export type QueryEngineType = (typeof QUERY_ENGINES)[number];

export const DIMENSIONS = [
  "query",
  "page",
  "country",
  "device",
  "searchAppearance",
  "date",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const SEARCH_TYPES = ["web", "image", "video", "news", "discover", "googleNews"] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

export const DATA_STATES = ["all", "final"] as const;
export type DataState = (typeof DATA_STATES)[number];

export const DEVICES = ["DESKTOP", "MOBILE", "TABLET"] as const;
export type DeviceFilter = (typeof DEVICES)[number];

export const GOOGLE_INDEXING_TYPES = ["URL_UPDATED", "URL_DELETED"] as const;
export type GoogleIndexingType = (typeof GOOGLE_INDEXING_TYPES)[number];

export interface SiteInfo {
  readonly siteUrl: string;
  readonly permissionLevel: string;
  readonly engine: QueryEngineType;
}

export interface SearchAnalyticsQuery {
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dimensions?: readonly Dimension[];
  readonly rowLimit?: number;
  readonly startRow?: number;
  readonly searchType?: SearchType;
  readonly dataState?: DataState;
  readonly queryFilter?: string;
  readonly pageFilter?: string;
  readonly countryFilter?: string;
  readonly deviceFilter?: DeviceFilter;
}

export interface AnalyticsRow {
  readonly keys: readonly string[];
  readonly clicks: number;
  readonly impressions: number;
  readonly ctr: number;
  readonly position: number;
}

export interface AnalyticsSummary {
  readonly totalClicks: number;
  readonly totalImpressions: number;
  readonly overallCtr: string;
  readonly overallPosition: string;
}

export interface AnalyticsResult {
  readonly engine: QueryEngineType;
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly columns: readonly string[];
  readonly summary: AnalyticsSummary;
  readonly rows: readonly AnalyticsRow[];
  readonly effectiveLimit: number;
  readonly note?: string;
}

export interface Issue {
  readonly severity?: string;
  readonly message?: string;
}

export interface MobileUsability {
  readonly verdict: string;
  readonly issues: ReadonlyArray<Issue & { readonly issueType: string }>;
}

export interface RichResultGroup {
  readonly type: string;
  readonly items: ReadonlyArray<{ readonly name?: string; readonly issues: readonly Issue[] }>;
}

export interface RichResults {
  readonly verdict: string;
  readonly detectedItems: readonly RichResultGroup[];
}

export interface UrlInspectionResult {
  readonly engine: QueryEngineType;
  readonly inspectionUrl: string;
  readonly siteUrl: string;
  readonly verdict: string;
  readonly coverageState?: string;
  readonly indexingState?: string;
  readonly lastCrawlTime?: string;
  readonly siteLastCrawlTime?: string;
  readonly crawledAs?: string;
  readonly robotsTxtState?: string;
  readonly pageFetchState?: string;
  readonly userCanonical?: string;
  readonly googleCanonical?: string;
  readonly referringUrls?: readonly string[];
  readonly sitemaps?: readonly string[];
  readonly mobileUsability?: MobileUsability;
  readonly richResults?: RichResults;
}

export interface SitemapContent {
  readonly type: string;
  readonly submitted: number;
  readonly indexed: number;
}

export interface SitemapInfo {
  readonly path: string;
  readonly engine: QueryEngineType;
  readonly lastSubmitted?: string;
  readonly lastDownloaded?: string;
  readonly type?: string;
  readonly errors?: number;
  readonly warnings?: number;
  readonly status?: string;
  readonly submittedUrls?: number;
  readonly indexedUrls?: number;
  readonly contents?: readonly SitemapContent[];
}

export interface IndexNowSubmissionResult {
  readonly engine: "indexnow";
  readonly host: string;
  readonly submittedCount: number;
  readonly statusCode: number;
  readonly statusMessage: string;
  readonly urlList: readonly string[];
}

export interface GoogleIndexingItemResult {
  readonly url: string;
  readonly type: GoogleIndexingType;
  readonly success: boolean;
  readonly statusCode: number;
  readonly message: string;
  readonly notifyTime?: string;
}

export interface GoogleIndexingSubmissionResult {
  readonly engine: "google";
  readonly submittedCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly notificationType: GoogleIndexingType;
  readonly items: readonly GoogleIndexingItemResult[];
}
