export type EngineType = "google" | "bing" | "indexnow";

export interface SiteInfo {
  siteUrl: string;
  permissionLevel: string;
  engine: EngineType;
}

export interface SearchAnalyticsQuery {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  startRow?: number;
  searchType?: string;
  dataState?: "all" | "final";
  queryFilter?: string;
  pageFilter?: string;
  countryFilter?: string;
  deviceFilter?: "DESKTOP" | "MOBILE" | "TABLET";
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
  engine: EngineType;
  siteUrl: string;
  startDate: string;
  endDate: string;
  columns: string[];
  summary: AnalyticsSummary;
  rows: AnalyticsRow[];
}

export interface UrlInspectionResult {
  engine: EngineType;
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
  engine: EngineType;
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
