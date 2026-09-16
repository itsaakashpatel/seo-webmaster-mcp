import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registry } from "../core/registry.js";

export function registerSearchAnalyticsTool(server: McpServer) {
  server.tool(
    "search_analytics",
    "Query search performance and analytics data (clicks, impressions, CTR, average position) across Google Search Console or Bing Webmaster Tools.",
    {
      siteUrl: z
        .string()
        .describe(
          "Site URL exactly as verified in Search Console (e.g. https://example.com/ or sc-domain:example.com)"
        ),
      startDate: z
        .string()
        .describe("Start date in YYYY-MM-DD format (e.g. 2026-08-01)"),
      endDate: z
        .string()
        .describe("End date in YYYY-MM-DD format (e.g. 2026-08-28)"),
      engine: z
        .enum(["google", "bing"])
        .optional()
        .default("google")
        .describe("Search engine provider: 'google' or 'bing' (default: 'google')"),
      dimensions: z
        .string()
        .optional()
        .describe(
          "Comma-separated dimensions to group by: query, page, country, device, searchAppearance, date. Default: 'query'"
        ),
      rowLimit: z
        .number()
        .optional()
        .default(100)
        .describe("Max rows to return (default 100, maximum 25000)"),
      searchType: z
        .enum(["web", "image", "video", "news", "discover", "googleNews"])
        .optional()
        .default("web")
        .describe("Search vertical: web, image, video, news, discover, googleNews (default: web)"),
      dataState: z
        .enum(["all", "final"])
        .optional()
        .default("all")
        .describe("Data freshness (Google): 'all' includes fresh (recent ~2 days) data, 'final' only finalized"),
      queryFilter: z
        .string()
        .optional()
        .describe(
          "Filter queries: plain text (contains), 'exact:keyword', 'regex:pattern', or '!regex:pattern'"
        ),
      pageFilter: z
        .string()
        .optional()
        .describe(
          "Filter page URLs: plain text (contains), 'exact:url', 'regex:pattern', or '!regex:pattern'"
        ),
      countryFilter: z
        .string()
        .optional()
        .describe("Filter by ISO 3166-1 alpha-3 country code (e.g. USA, GBR, IND, DEU)"),
      deviceFilter: z
        .enum(["DESKTOP", "MOBILE", "TABLET"])
        .optional()
        .describe("Filter by device: DESKTOP, MOBILE, or TABLET"),
      startRow: z
        .number()
        .optional()
        .default(0)
        .describe("Zero-based row offset for pagination"),
    },
    async ({
      siteUrl,
      startDate,
      endDate,
      engine,
      dimensions,
      rowLimit,
      searchType,
      dataState,
      queryFilter,
      pageFilter,
      countryFilter,
      deviceFilter,
      startRow,
    }) => {
      try {
        const provider = registry.get(engine);
        if (!provider) {
          throw new Error(`Provider "${engine}" is not registered.`);
        }

        const dimensionList = dimensions
          ? dimensions.split(",").map((d) => d.trim().toLowerCase())
          : ["query"];

        const result = await provider.queryAnalytics({
          siteUrl,
          startDate,
          endDate,
          dimensions: dimensionList,
          rowLimit,
          searchType,
          dataState,
          queryFilter,
          pageFilter,
          countryFilter,
          deviceFilter,
          startRow,
        });

        if (result.rows.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No search analytics data found for **${siteUrl}** on **${provider.displayName}** between ${startDate} and ${endDate}.`,
              },
            ],
          };
        }

        const columnHeaders = [
          ...result.columns.map((c) => c.charAt(0).toUpperCase() + c.slice(1)),
          "Clicks",
          "Impressions",
          "CTR",
          "Avg Position",
        ];

        const headerLine = `| ${columnHeaders.join(" | ")} |`;
        const separatorLine = `| ${columnHeaders.map(() => "---").join(" | ")} |`;

        const dataLines = result.rows.map((row) => {
          const keys = row.keys.map((k) => String(k).replace(/\|/g, "\\|"));
          while (keys.length < result.columns.length) {
            keys.push("-");
          }
          const ctr = ((row.ctr || 0) * 100).toFixed(2) + "%";
          const pos = (row.position || 0).toFixed(1);
          const clicks = (row.clicks || 0).toLocaleString();
          const impressions = (row.impressions || 0).toLocaleString();

          return `| ${[...keys, clicks, impressions, ctr, pos].join(" | ")} |`;
        });

        const summaryCard = [
          `### Search Analytics: ${siteUrl} (${provider.displayName})`,
          `- **Date Range:** ${startDate} to ${endDate}`,
          `- **Rows Returned:** ${result.rows.length}${
            result.rows.length === rowLimit ? ` (reached limit of ${rowLimit})` : ""
          }`,
          `- **Total Clicks:** ${result.summary.totalClicks.toLocaleString()}`,
          `- **Total Impressions:** ${result.summary.totalImpressions.toLocaleString()}`,
          `- **Average CTR:** ${result.summary.overallCtr}`,
          `- **Average Position:** ${result.summary.overallPosition}`,
        ].join("\n");

        const fullOutput = `${summaryCard}\n\n${headerLine}\n${separatorLine}\n${dataLines.join("\n")}`;

        return {
          content: [
            {
              type: "text",
              text: fullOutput,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error querying search analytics: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}
