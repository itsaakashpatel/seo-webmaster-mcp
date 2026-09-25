import test from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { errText, okText } from "../build/core/responses.js";
import { registerAllTools } from "../build/tools/index.js";
import { renderEngineStatus } from "../build/tools/engine-status.js";
import { renderInspection } from "../build/tools/inspect-url.js";
import { renderSitemaps } from "../build/tools/list-sitemaps.js";
import { withErrorBoundary } from "../build/tools/shared.js";

test("MCP response helpers construct compliant structures", () => {
  assert.deepEqual(okText("Success output"), {
    content: [{ type: "text", text: "Success output" }],
  });
  assert.deepEqual(errText("Failure message"), {
    isError: true,
    content: [{ type: "text", text: "Failure message" }],
  });
});

test("registerAllTools registers every tool exactly once", () => {
  const server = new McpServer({ name: "test-seo-webmaster", version: "1.0.0" });
  assert.doesNotThrow(() => registerAllTools(server));
  // The SDK rejects a second registration of the same name, which proves the first one happened.
  assert.throws(() => registerAllTools(server), /already registered/);
});

test("withErrorBoundary turns a thrown error into an isError result with a prefix", async () => {
  const handler = withErrorBoundary("Error doing work", async (_args: { id: string }) => {
    throw new Error("boom");
  });
  assert.deepEqual(await handler({ id: "x" }), errText("Error doing work: boom"));
});

test("renderEngineStatus lists setup guides only for missing engines", () => {
  const text = renderEngineStatus([
    { name: "Google", id: "google", configured: true, authMethod: "JSON", guide: "G-GUIDE" },
    { name: "Bing", id: "bing", configured: false, authMethod: "Key", guide: "B-GUIDE" },
  ]);
  assert.match(text, /\| Google \| `google` \| ✅ Connected \| JSON \|/);
  assert.match(text, /\*\*Bing:\*\*\nB-GUIDE/);
  assert.ok(!text.includes("G-GUIDE"));
});

test("renderSitemaps shows the Bing submitted count and '-' for unknown errors", () => {
  const text = renderSitemaps("https://example.com", "Bing Webmaster Tools", [
    { path: "https://example.com/sitemap.xml", engine: "bing", submittedUrls: 1500 },
  ]);
  assert.match(
    text,
    /\| `https:\/\/example\.com\/sitemap\.xml` \| never \| never \| Sitemap \| - \| Unknown \|/,
  );
  assert.match(text, /- \*\*Submitted URLs\*\*: 1,500/);
});

test("renderInspection labels Bing crawl time as site-level and skips empty sections", () => {
  const text = renderInspection(
    {
      engine: "bing",
      inspectionUrl: "https://example.com/a",
      siteUrl: "https://example.com",
      verdict: "UNKNOWN",
      siteLastCrawlTime: "2023-09-18T00:00:00.000Z",
    },
    "Bing Webmaster Tools",
  );
  assert.match(
    text,
    /- \*\*Site Last Crawled:\*\* 2023-09-18T00:00:00.000Z \(site-level crawl context\)/,
  );
  assert.ok(!text.includes("- **Last Crawled:**"));
  assert.ok(!text.includes("Mobile Usability"));
});
