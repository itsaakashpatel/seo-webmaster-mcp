import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { code, formatDate, markdownTable } from "../core/markdown.js";
import { okText } from "../core/responses.js";
import type { SitemapInfo } from "../core/types.js";
import { providers } from "../providers/index.js";
import {
  READ_ONLY,
  engineSchema,
  renderSitemapCounts,
  siteUrlSchema,
  withErrorBoundary,
} from "./shared.js";

export function renderSitemaps(
  siteUrl: string,
  providerName: string,
  sitemaps: readonly SitemapInfo[],
): string {
  const table = markdownTable(
    ["Sitemap Path", "Last Submitted", "Last Crawled", "Type", "Errors", "Status"],
    sitemaps.map((sitemap) => [
      code(sitemap.path),
      formatDate(sitemap.lastSubmitted, "never"),
      formatDate(sitemap.lastDownloaded, "never"),
      sitemap.type || "Sitemap",
      sitemap.errors ?? "-",
      sitemap.status || "Unknown",
    ]),
  );
  const breakdown = sitemaps.flatMap((sitemap) => {
    const counts = renderSitemapCounts(sitemap);
    return counts.length > 0 ? [`\n**${code(sitemap.path)}**:`, ...counts] : [];
  });
  return [
    `### Sitemaps for ${code(siteUrl)} (${providerName})\n`,
    table,
    ...(breakdown.length > 0 ? ["\n#### Indexed vs Submitted URLs:", ...breakdown] : []),
  ].join("\n");
}

export function registerListSitemapsTool(server: McpServer): void {
  server.registerTool(
    "list_sitemaps",
    {
      title: "List Sitemaps",
      description:
        "List all submitted sitemaps and their current status, last download date, error counts, and indexed URL counts.",
      inputSchema: { siteUrl: siteUrlSchema, engine: engineSchema },
      annotations: READ_ONLY,
    },
    withErrorBoundary("Error listing sitemaps", async ({ siteUrl, engine }) => {
      const provider = providers[engine];
      const sitemaps = await provider.listSitemaps(siteUrl);
      return okText(
        sitemaps.length === 0
          ? `No sitemaps found for **${siteUrl}** on ${provider.displayName}.`
          : renderSitemaps(siteUrl, provider.displayName, sitemaps),
      );
    }),
  );
}
