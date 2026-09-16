#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registry } from "./core/registry.js";
import { GoogleSearchConsoleProvider } from "./providers/google/provider.js";
import { BingWebmasterProvider } from "./providers/bing/provider.js";

import { registerEngineStatusTool } from "./tools/engine-status.js";
import { registerListSitesTool } from "./tools/list-sites.js";
import { registerSearchAnalyticsTool } from "./tools/search-analytics.js";
import { registerInspectUrlTool } from "./tools/inspect-url.js";
import { registerSitemapsTools } from "./tools/sitemaps.js";
import { registerSubmitUrlsTool } from "./tools/submit-urls.js";

// Register search engine providers
registry.register(new GoogleSearchConsoleProvider());
registry.register(new BingWebmasterProvider());

// Initialize MCP server
const server = new McpServer({
  name: "seo-webmaster-mcp",
  version: "1.0.0",
});

// Register MCP tools
registerEngineStatusTool(server);
registerListSitesTool(server);
registerSearchAnalyticsTool(server);
registerInspectUrlTool(server);
registerSitemapsTools(server);
registerSubmitUrlsTool(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SEO & Webmaster MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting SEO & Webmaster MCP server:", error);
  process.exit(1);
});
