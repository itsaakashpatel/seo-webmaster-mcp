import type {
  AnalyticsResult,
  QueryEngineType,
  SearchAnalyticsQuery,
  SiteInfo,
  SitemapInfo,
  UrlInspectionResult,
} from "./types.js";

/** The adapter contract that every query engine (Google, Bing) implements. */
export interface SearchEngineProvider {
  readonly engine: QueryEngineType;
  readonly displayName: string;
  /** A short label for the credentials this engine needs, shown by `engine_status`. */
  readonly authMethod: string;

  isConfigured(): boolean;
  getConfigurationGuide(): string;
  listSites(): Promise<SiteInfo[]>;
  queryAnalytics(query: SearchAnalyticsQuery): Promise<AnalyticsResult>;
  inspectUrl(siteUrl: string, url: string, languageCode?: string): Promise<UrlInspectionResult>;
  listSitemaps(siteUrl: string): Promise<SitemapInfo[]>;
  getSitemap(siteUrl: string, feedpath: string): Promise<SitemapInfo>;
}
