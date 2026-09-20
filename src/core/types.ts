export type QueryEngineType = "google" | "bing";
export type EngineType = QueryEngineType | "indexnow";

export type SearchType = "web" | "image" | "video" | "news" | "discover" | "googleNews";
export type DataState = "all" | "final";
export type DeviceFilter = "DESKTOP" | "MOBILE" | "TABLET";

export interface SiteInfo {
  readonly siteUrl: string;
  readonly permissionLevel: string;
  readonly engine: QueryEngineType;
}

export interface SearchAnalyticsQuery {
  readonly siteUrl: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dimensions?: readonly string[];
  readonly rowLimit?: number;
  readonly startRow?: number;
  readonly searchType?: SearchType | string;
  readonly dataState?: DataState | string;
  readonly queryFilter?: string;
  readonly pageFilter?: string;
  readonly countryFilter?: string;
  readonly deviceFilter?: DeviceFilter;
}

export interface AnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface AnalyticsSummary {
  totalClicks: number;
  totalImpressions: number;
  overallCtr: string;
  overallPosition: string;
}

export interface AnalyticsResult {
  engine: QueryEngineType;
  siteUrl: string;
  startDate: string;
  endDate: string;
  columns: string[];
  summary: AnalyticsSummary;
  rows: AnalyticsRow[];
  effectiveLimit: number;
  note?: string;
}

export interface UrlInspectionResult {
  engine: QueryEngineType;
  inspectionUrl: string;
  siteUrl: string;
  verdict: string;
  coverageState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  crawledAs?: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  userCanonical?: string;
  googleCanonical?: string;
  referringUrls?: string[];
  sitemaps?: string[];
  mobileUsability?: {
    verdict: string;
    issues?: Array<{
      issueType: string;
      severity?: string;
      message?: string;
    }>;
  };
  richResults?: {
    verdict: string;
    detectedItems?: Array<{
      type: string;
      items?: Array<{
        name?: string;
        issues?: Array<{
          severity?: string;
          message?: string;
        }>;
      }>;
    }>;
  };
}

export interface SitemapInfo {
  path: string;
  engine: QueryEngineType;
  lastSubmitted?: string;
  lastDownloaded?: string;
  type?: string;
  errors?: number;
  warnings?: number;
  status?: string;
  submittedUrls?: number;
  indexedUrls?: number;
  contents?: Array<{
    type: string;
    submitted: number;
    indexed: number;
  }>;
}

export interface IndexNowSubmissionResult {
  engine: "indexnow" | "bing";
  host: string;
  submittedCount: number;
  statusCode: number;
  statusMessage: string;
  urlList: string[];
}

export type GoogleIndexingType = "URL_UPDATED" | "URL_DELETED";

export interface GoogleIndexingItemResult {
  url: string;
  type: GoogleIndexingType;
  success: boolean;
  statusCode: number;
  message: string;
  notifyTime?: string;
}

export interface GoogleIndexingSubmissionResult {
  engine: "google";
  submittedCount: number;
  successCount: number;
  failureCount: number;
  notificationType: GoogleIndexingType;
  items: GoogleIndexingItemResult[];
}
