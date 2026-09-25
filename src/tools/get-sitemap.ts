import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { code, fieldList, formatCount } from "../core/markdown.js";
import { okText } from "../core/responses.js";
import type { SitemapInfo } from "../core/types.js";
import { providers } from "../providers/index.js";
import { renderSitemapCounts } from "./list-sitemaps.js";
import { READ_ONLY, engineSchema, siteUrlSchema, withErrorBoundary } from "./shared.js";

function optionalCount(value: number | undefined): string | undefined {
  return value === undefined ? undefined : formatCount(value);
}

export function renderSitemap(siteUrl: string, providerName: string, sitemap: SitemapInfo): string {
  const counts = renderSitemapCounts(sitemap);
  return [
    `### Sitemap Details: ${code(sitemap.path)}`,
    ...fieldList([
      ["Provider", providerName],
      ["Site", code(siteUrl)],
      ["Type", sitemap.type ?? "Sitemap"],
      ["Status", sitemap.status ?? "Unknown"],
      ["Last Submitted", sitemap.lastSubmitted ?? "Never"],
      ["Last Downloaded", sitemap.lastDownloaded ?? "Never"],
      ["Errors", sitemap.errors ?? "N/A"],
      ["Warnings", sitemap.warnings ?? "N/A"],
      ["Indexed URLs", optionalCount(sitemap.indexedUrls)],
    ]),
    ...(counts.length > 0 ? ["\n#### Contents Breakdown:", ...counts] : []),
  ].join("\n");
}

export function registerGetSitemapTool(server: McpServer): void {
  server.registerTool(
    "get_sitemap",
    {
      title: "Get Sitemap",
      description: "Retrieve deep indexing and error metrics for a specific sitemap feed.",
      inputSchema: {
        siteUrl: siteUrlSchema,
        feedpath: z
          .string()
          .trim()
          .min(1)
          .describe(
            "Full URL or relative path to the sitemap (e.g. https://example.com/sitemap.xml)",
          ),
        engine: engineSchema,
      },
      annotations: READ_ONLY,
    },
    withErrorBoundary("Error getting sitemap details", async ({ siteUrl, feedpath, engine }) => {
      const provider = providers[engine];
      const sitemap = await provider.getSitemap(siteUrl, feedpath);
      return okText(renderSitemap(siteUrl, provider.displayName, sitemap));
    }),
  );
}
