import {
  QueryEngineType,
  SiteInfo,
  SearchAnalyticsQuery,
  AnalyticsResult,
  UrlInspectionResult,
  SitemapInfo,
} from "./types.js";

export interface SearchEngineProvider {
  readonly engine: QueryEngineType;
  readonly displayName: string;

  /**
   * Check if credentials / API keys are configured for this provider.
   */
  isConfigured(): boolean;

  /**
   * Returns step-by-step setup guidance if this provider is not configured.
   */
  getConfigurationGuide(): string;

  /**
   * List verified sites/properties on this search engine.
   */
  listSites(): Promise<SiteInfo[]>;

  /**
   * Query search performance / analytics data.
   */
  queryAnalytics(query: SearchAnalyticsQuery): Promise<AnalyticsResult>;

  /**
   * Inspect live indexing & crawl status of a URL (if supported by provider).
   */
  inspectUrl?(siteUrl: string, url: string, language?: string): Promise<UrlInspectionResult>;

  /**
   * List submitted sitemaps and their indexing status.
   */
  listSitemaps?(siteUrl: string): Promise<SitemapInfo[]>;

  /**
   * Get deep metrics for a specific sitemap feed.
   */
  getSitemap?(siteUrl: string, feedpath: string): Promise<SitemapInfo>;
}
