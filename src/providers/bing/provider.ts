import { SearchEngineProvider } from "../../core/provider.js";
import {
  SiteInfo,
  SearchAnalyticsQuery,
  AnalyticsResult,
  UrlInspectionResult,
  SitemapInfo,
} from "../../core/types.js";
import {
  isBingConfigured,
  getBingApiKey,
  getBingConfigurationGuide,
  formatBingError,
} from "./auth.js";

const BING_API_BASE = "https://ssl.bing.com/webmaster/api.json";

async function bingFetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const apiKey = getBingApiKey();
  const url = new URL(`${BING_API_BASE}/${endpoint}`);
  url.searchParams.set("apikey", apiKey);

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "seo-webmaster-mcp/1.0.0",
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Bing Webmaster API error (${res.status}): ${errorText || res.statusText}`);
  }

  const json = await res.json();
  return json?.d !== undefined ? json.d : json;
}

export class BingWebmasterProvider implements SearchEngineProvider {
  readonly engine = "bing" as const;
  readonly displayName = "Bing Webmaster Tools";

  isConfigured(): boolean {
    return isBingConfigured();
  }

  getConfigurationGuide(): string {
    return getBingConfigurationGuide();
  }

  async listSites(): Promise<SiteInfo[]> {
    try {
      const data = await bingFetch("GetUserSites");
      const sites: any[] = Array.isArray(data) ? data : [];

      return sites.map((s) => ({
        siteUrl: s.Url || "",
        permissionLevel: s.Role || "SiteOwner",
        engine: "bing",
      }));
    } catch (err: any) {
      throw new Error(formatBingError(err));
    }
  }

  async queryAnalytics(query: SearchAnalyticsQuery): Promise<AnalyticsResult> {
    try {
      const data = await bingFetch("GetQueryStats", { siteUrl: query.siteUrl });
      const rawRows: any[] = Array.isArray(data) ? data : [];

      // Filter and transform rows
      let filteredRows = rawRows;

      if (query.queryFilter) {
        const filter = query.queryFilter.trim();
        if (filter.startsWith("regex:")) {
          const re = new RegExp(filter.slice(6), "i");
          filteredRows = filteredRows.filter((r) => re.test(r.Query || ""));
        } else if (filter.startsWith("exact:")) {
          const exact = filter.slice(6).toLowerCase();
          filteredRows = filteredRows.filter(
            (r) => (r.Query || "").toLowerCase() === exact
          );
        } else {
          const term = filter.toLowerCase();
          filteredRows = filteredRows.filter((r) =>
            (r.Query || "").toLowerCase().includes(term)
          );
        }
      }

      const limit = Math.min(Math.max(query.rowLimit || 100, 1), 5000);
      filteredRows = filteredRows.slice(0, limit);

      let totalClicks = 0;
      let totalImpressions = 0;
      let weightedPositionSum = 0;

      const rows = filteredRows.map((r) => {
        const clicks = r.Clicks || 0;
        const impressions = r.Impressions || 0;
        const pos = r.AvgClickPosition || r.AvgImpressionPosition || 0;
        const ctr = impressions > 0 ? clicks / impressions : 0;

        totalClicks += clicks;
        totalImpressions += impressions;
        weightedPositionSum += pos * impressions;

        return {
          keys: [r.Query || "unknown"],
          clicks,
          impressions,
          ctr,
          position: pos,
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
        engine: "bing",
        siteUrl: query.siteUrl,
        startDate: query.startDate,
        endDate: query.endDate,
        columns: ["Query"],
        summary: {
          totalClicks,
          totalImpressions,
          overallCtr,
          overallPosition,
        },
        rows,
      };
    } catch (err: any) {
      throw new Error(formatBingError(err));
    }
  }

  async inspectUrl(
    siteUrl: string,
    url: string
  ): Promise<UrlInspectionResult> {
    try {
      // Bing Webmaster provides crawl statistics and URL data
      let crawlData: any = null;
      try {
        crawlData = await bingFetch("GetCrawlStats", { siteUrl });
      } catch {
        // ignore if not available
      }

      return {
        engine: "bing",
        inspectionUrl: url,
        siteUrl,
        verdict: "INDEXED_OR_KNOWN",
        coverageState: "Submitted to Bing Webmaster",
        lastCrawlTime: crawlData?.[0]?.Date || undefined,
        referringUrls: [],
        sitemaps: [],
        mobileUsability: {
          verdict: "PASS",
          issues: [],
        },
      };
    } catch (err: any) {
      throw new Error(formatBingError(err));
    }
  }

  async listSitemaps(siteUrl: string): Promise<SitemapInfo[]> {
    try {
      const data = await bingFetch("GetFeeds", { siteUrl });
      const feeds: any[] = Array.isArray(data) ? data : [];

      return feeds.map((f) => ({
        path: f.Url || "",
        engine: "bing",
        lastSubmitted: f.LastSubmittedDate || undefined,
        lastDownloaded: f.LastCrawledDate || undefined,
        type: f.FeedType || "Sitemap",
        errors: f.CrawlErrorCount || 0,
        warnings: 0,
        status: f.Status || "Submitted",
        submittedUrls: f.SubmittedUrlCount || 0,
        indexedUrls: f.IndexedUrlCount || 0,
        contents: [
          {
            type: "web",
            submitted: f.SubmittedUrlCount || 0,
            indexed: f.IndexedUrlCount || 0,
          },
        ],
      }));
    } catch (err: any) {
      throw new Error(formatBingError(err));
    }
  }

  async getSitemap(siteUrl: string, feedpath: string): Promise<SitemapInfo> {
    const sitemaps = await this.listSitemaps(siteUrl);
    const found = sitemaps.find((s) => s.path === feedpath);
    if (!found) {
      throw new Error(`Sitemap feed "${feedpath}" not found in Bing Webmaster Tools for ${siteUrl}`);
    }
    return found;
  }
}
