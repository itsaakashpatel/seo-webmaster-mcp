import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerListSitemapsTool } from "./list-sitemaps.js";
import { registerGetSitemapTool } from "./get-sitemap.js";

export function registerSitemapsTools(server: McpServer): void {
  registerListSitemapsTool(server);
  registerGetSitemapTool(server);
}
