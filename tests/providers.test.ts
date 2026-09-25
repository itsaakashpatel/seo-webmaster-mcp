import test from "node:test";
import assert from "node:assert/strict";
import { formatBingError, isBingConfigured } from "../build/providers/bing/auth.js";
import { BingWebmasterProvider } from "../build/providers/bing/provider.js";
import { formatGoogleError, isGoogleConfigured } from "../build/providers/google/auth.js";
import { GoogleSearchConsoleProvider } from "../build/providers/google/provider.js";
import { isIndexNowConfigured } from "../build/providers/indexnow/provider.js";

test("formatBingError formats 401 unauthorized with setup guidance", () => {
  const err: Record<string, unknown> = { code: 401, message: "Invalid API Key" };
  const msg: string = formatBingError(err);
  assert.ok(msg.includes("401 Invalid API Key"));
  assert.ok(msg.includes("BING_WEBMASTER_API_KEY"));
});

test("formatBingError formats 403 forbidden", () => {
  const err: Record<string, unknown> = { code: 403, message: "Access denied" };
  const msg: string = formatBingError(err);
  assert.ok(msg.includes("Bing Webmaster permission denied (403)"));
});

test("formatGoogleError formats 403 permission error with user role tip", () => {
  const err: Record<string, unknown> = {
    code: 403,
    message: "User does not have sufficient permission",
  };
  const msg: string = formatGoogleError(err);
  assert.ok(msg.includes("Permission error (403)"));
  assert.ok(msg.includes("Restricted"));

  const indexingMsg: string = formatGoogleError(err, "indexing");
  assert.ok(indexingMsg.includes("'Owner'"));
  assert.ok(!indexingMsg.includes("Restricted"));
});

test("formatGoogleError formats 429 quota error by context", () => {
  const err: Record<string, unknown> = { code: 429, message: "Quota exceeded" };
  const gscMsg: string = formatGoogleError(err);
  assert.ok(gscMsg.includes("Quota exceeded (429)"));
  assert.ok(gscMsg.includes("Search Console query or inspection quota exceeded"));

  const indexingMsg: string = formatGoogleError(err, "indexing");
  assert.ok(indexingMsg.includes("Quota exceeded (429)"));
  assert.ok(indexingMsg.includes("200 publish requests per day"));
});

test("BingWebmasterProvider implements SearchEngineProvider contract", () => {
  const provider = new BingWebmasterProvider();
  assert.equal(provider.engine, "bing");
  assert.equal(provider.displayName, "Bing Webmaster Tools");
  assert.equal(typeof provider.isConfigured, "function");
  assert.equal(typeof provider.listSites, "function");
  assert.equal(typeof provider.queryAnalytics, "function");
  assert.equal(typeof provider.inspectUrl, "function");
  assert.equal(typeof provider.listSitemaps, "function");
  assert.equal(typeof provider.getSitemap, "function");
});

test("GoogleSearchConsoleProvider implements SearchEngineProvider contract", () => {
  const provider = new GoogleSearchConsoleProvider();
  assert.equal(provider.engine, "google");
  assert.equal(provider.displayName, "Google Search Console");
  assert.equal(typeof provider.isConfigured, "function");
  assert.equal(typeof provider.listSites, "function");
  assert.equal(typeof provider.queryAnalytics, "function");
  assert.equal(typeof provider.inspectUrl, "function");
  assert.equal(typeof provider.listSitemaps, "function");
  assert.equal(typeof provider.getSitemap, "function");
});

test("Configuration helpers safely check environment without throwing", () => {
  assert.equal(typeof isBingConfigured(), "boolean");
  assert.equal(typeof isGoogleConfigured(), "boolean");
  assert.equal(typeof isIndexNowConfigured(), "boolean");
});

test("BingWebmasterProvider.listSitemaps correctly maps Bing Feed class properties and WCF dates", async () => {
  const originalKey = process.env.BING_WEBMASTER_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.BING_WEBMASTER_API_KEY = "dummy-key-for-test";

  try {
    const mockFeedResponse = [
      {
        Url: "https://example.com/sitemap.xml",
        UrlCount: 150,
        Submitted: "/Date(1690000000000)/",
        LastCrawled: "/Date(1690086400000)/",
        Type: "Sitemap",
        Status: "Success",
        Compressed: false,
        FileSize: 2048,
      },
    ];

    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockFeedResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const provider = new BingWebmasterProvider();
    const sitemaps = await provider.listSitemaps("https://example.com");

    assert.equal(sitemaps.length, 1);
    const sm = sitemaps[0];
    assert.ok(sm);
    assert.equal(sm.path, "https://example.com/sitemap.xml");
    assert.equal(sm.engine, "bing");
    assert.equal(sm.submittedUrls, 150);
    assert.equal(sm.indexedUrls, undefined);
    assert.equal(sm.errors, undefined);
    assert.equal(sm.warnings, undefined);
    assert.equal(sm.type, "Sitemap");
    assert.equal(sm.status, "Success");
    assert.equal(sm.contents, undefined);
    assert.ok(sm.lastSubmitted && sm.lastSubmitted.startsWith("2023-07-22"));
    assert.ok(sm.lastDownloaded && sm.lastDownloaded.startsWith("2023-07-23"));
  } finally {
    process.env.BING_WEBMASTER_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  }
});

test("BingWebmasterProvider.queryAnalytics filters date range and aggregates weekly buckets", async () => {
  const originalKey = process.env.BING_WEBMASTER_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.BING_WEBMASTER_API_KEY = "dummy-key-for-test";

  try {
    const mockQueryStats = [
      {
        Query: "seo tools",
        Clicks: 10,
        Impressions: 100,
        AvgClickPosition: 9.0, // ignored: impression position wins
        AvgImpressionPosition: 2.0,
        Date: "/Date(1689465600000)/", // 2023-07-16
      },
      {
        Query: "seo tools",
        Clicks: 20,
        Impressions: 100,
        AvgClickPosition: -1, // Bing sentinel for "no value"
        AvgImpressionPosition: 1.0,
        Date: "/Date(1690070400000)/", // 2023-07-23
      },
      {
        Query: "old query",
        Clicks: 5,
        Impressions: 50,
        AvgClickPosition: 5.0,
        AvgImpressionPosition: 5.0,
        Date: "/Date(1600000000000)/", // 2020-09-13 (outside date range)
      },
    ];

    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockQueryStats), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const provider = new BingWebmasterProvider();
    const result = await provider.queryAnalytics({
      siteUrl: "https://example.com",
      startDate: "2023-07-01",
      endDate: "2023-07-31",
      searchType: "web",
      dataState: "all",
      dimensions: ["query"],
    });

    assert.equal(result.engine, "bing");
    assert.equal(result.columns[0], "query");
    assert.equal(result.rows.length, 1); // "old query" filtered out, "seo tools" aggregated

    const row = result.rows[0];
    assert.ok(row);
    assert.deepEqual(row.keys, ["seo tools"]);
    assert.equal(row.clicks, 30);
    assert.equal(row.impressions, 200);
    assert.equal(row.ctr, 30 / 200);
    assert.equal(row.position, 1.5); // (2.0*100 + 1.0*100) / 200 = 1.5

    assert.equal(result.summary.totalClicks, 30);
    assert.equal(result.summary.totalImpressions, 200);
    assert.equal(result.summary.overallCtr, "15.00%");
    assert.equal(result.summary.overallPosition, "1.5");

    // Notes should not report searchType or dataState since they were defaults
    assert.ok(result.note);
    assert.ok(!result.note.includes("searchType"));
    assert.ok(!result.note.includes("dataState"));
    assert.ok(result.note.includes("weekly bucketed statistics"));
  } finally {
    process.env.BING_WEBMASTER_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  }
});

test("BingWebmasterProvider.queryAnalytics routes to GetPageStats in page mode", async () => {
  const originalKey = process.env.BING_WEBMASTER_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.BING_WEBMASTER_API_KEY = "dummy-key-for-test";

  try {
    let requestedEndpoint = "";
    globalThis.fetch = async (url) => {
      requestedEndpoint = String(url);
      const mockPageStats = [
        {
          Query: "https://example.com/blog/article",
          Clicks: 15,
          Impressions: 150,
          AvgClickPosition: 3.2,
          AvgImpressionPosition: 3.5,
          Date: "/Date(1689465600000)/",
        },
      ];
      return new Response(JSON.stringify(mockPageStats), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const provider = new BingWebmasterProvider();
    const result = await provider.queryAnalytics({
      siteUrl: "https://example.com",
      startDate: "2023-07-01",
      endDate: "2023-07-31",
      dimensions: ["page"],
    });

    assert.ok(requestedEndpoint.includes("GetPageStats"));
    assert.equal(result.columns[0], "page");
    assert.equal(result.rows.length, 1);
    assert.deepEqual(result.rows[0]?.keys, ["https://example.com/blog/article"]);
    assert.equal(result.rows[0]?.clicks, 15);
  } finally {
    process.env.BING_WEBMASTER_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  }
});

test("BingWebmasterProvider.inspectUrl labels site-level crawl context and selects newest crawl entry", async () => {
  const originalKey = process.env.BING_WEBMASTER_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.BING_WEBMASTER_API_KEY = "dummy-key-for-test";

  try {
    const mockCrawlStats = [
      {
        Date: "/Date(1680000000000)/", // older date (March 2023)
        CrawlAttempts: 40,
      },
      {
        Date: "/Date(1695000000000)/", // newer date (September 2023)
        CrawlAttempts: 80,
      },
    ];

    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockCrawlStats), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const provider = new BingWebmasterProvider();
    const inspection = await provider.inspectUrl(
      "https://example.com",
      "https://example.com/test-page",
    );

    assert.equal(inspection.engine, "bing");
    assert.equal(inspection.verdict, "UNKNOWN");
    assert.equal(inspection.lastCrawlTime, undefined); // Not falsified as URL crawl time
    assert.ok(inspection.siteLastCrawlTime); // Labeled as site-level
    assert.ok(inspection.siteLastCrawlTime.startsWith("2023-09-18")); // Picked newer date
    assert.ok(inspection.coverageState?.includes("property level"));
  } finally {
    process.env.BING_WEBMASTER_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  }
});
