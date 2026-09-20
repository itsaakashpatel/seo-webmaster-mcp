import test from "node:test";
import assert from "node:assert/strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEngineStatusTool } from "../build/tools/engine-status.js";
import { registerListSitesTool } from "../build/tools/list-sites.js";
import { registerSearchAnalyticsTool } from "../build/tools/search-analytics.js";
import { registerInspectUrlTool } from "../build/tools/inspect-url.js";
import { registerListSitemapsTool } from "../build/tools/list-sitemaps.js";
import { registerGetSitemapTool } from "../build/tools/get-sitemap.js";
import { registerSubmitUrlsTool } from "../build/tools/submit-urls.js";
import { registerSubmitGoogleUrlsTool } from "../build/tools/submit-google.js";
import { okText, errText } from "../build/core/responses.js";

test("MCP response helpers construct compliant structures", () => {
  const ok = okText("Success output");
  assert.deepEqual(ok, {
    content: [{ type: "text", text: "Success output" }],
  });

  const err = errText("Failure message");
  assert.deepEqual(err, {
    isError: true,
    content: [{ type: "text", text: "Failure message" }],
  });
});

test("All 8 MCP tools register successfully on McpServer instance", () => {
  const server = new McpServer({
    name: "test-seo-webmaster",
    version: "1.0.0",
  });

  assert.doesNotThrow(() => registerEngineStatusTool(server));
  assert.doesNotThrow(() => registerListSitesTool(server));
  assert.doesNotThrow(() => registerSearchAnalyticsTool(server));
  assert.doesNotThrow(() => registerInspectUrlTool(server));
  assert.doesNotThrow(() => registerListSitemapsTool(server));
  assert.doesNotThrow(() => registerGetSitemapTool(server));
  assert.doesNotThrow(() => registerSubmitUrlsTool(server));
  assert.doesNotThrow(() => registerSubmitGoogleUrlsTool(server));
});
