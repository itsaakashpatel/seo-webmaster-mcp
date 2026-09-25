import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEngineStatusTool } from "./engine-status.js";
import { registerGetSitemapTool } from "./get-sitemap.js";
import { registerInspectUrlTool } from "./inspect-url.js";
import { registerListSitemapsTool } from "./list-sitemaps.js";
import { registerListSitesTool } from "./list-sites.js";
import { registerSearchAnalyticsTool } from "./search-analytics.js";
import { registerSubmitGoogleUrlsTool } from "./submit-google.js";
import { registerSubmitUrlsTool } from "./submit-urls.js";

const TOOL_REGISTRARS: ReadonlyArray<(server: McpServer) => void> = [
  registerEngineStatusTool,
  registerListSitesTool,
  registerSearchAnalyticsTool,
  registerInspectUrlTool,
  registerListSitemapsTool,
  registerGetSitemapTool,
  registerSubmitUrlsTool,
  registerSubmitGoogleUrlsTool,
];

export function registerAllTools(server: McpServer): void {
  for (const register of TOOL_REGISTRARS) {
    register(server);
  }
}
