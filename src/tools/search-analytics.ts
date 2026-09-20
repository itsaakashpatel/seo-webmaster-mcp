import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registry } from "../core/registry.js";
import { parseDimensionList } from "../core/validation.js";
import { getErrorMessage } from "../core/errors.js";
import { okText, errText } from "../core/responses.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export function registerSearchAnalyticsTool(server: McpServer): void {
  server.tool(
    "search_analytics",
    "Query search performance and analytics data (clicks, impressions, CTR, average position) across Google Search Console or Bing Webmaster Tools.",
    {
      siteUrl: z
        .string()
        .min(1)
        .describe(
          "Site URL exactly as verified in Search Console (e.g. https://example.com/ or sc-domain:example.com)"
        ),
      startDate: dateSchema.describe("Start date in YYYY-MM-DD format (e.g. 2026-08-01)"),
      endDate: dateSchema.describe("End date in YYYY-MM-DD format (e.g. 2026-08-28)"),
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
        .int()
        .min(1)
        .max(25000)
        .optional()
        .default(100)
        .describe("Max rows to return (default 100, maximum 25000; Bing caps at 5000)"),
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
        .max(200)
        .optional()
        .describe(
          "Filter queries: plain text (contains), 'exact:keyword', 'regex:pattern', or '!regex:pattern'"
        ),
      pageFilter: z
        .string()
        .max(200)
        .optional()
        .describe(
          "Filter page URLs: plain text (contains), 'exact:url', 'regex:pattern', or '!regex:pattern'"
        ),
      countryFilter: z
        .string()
        .regex(/^[A-Za-z]{3}$/, "Use ISO 3166-1 alpha-3 (e.g. USA, GBR)")
        .optional()
        .describe("Filter by ISO 3166-1 alpha-3 country code (e.g. USA, GBR, IND, DEU)"),
      deviceFilter: z
        .enum(["DESKTOP", "MOBILE", "TABLET"])
        .optional()
        .describe("Filter by device: DESKTOP, MOBILE, or TABLET"),
      startRow: z
        .number()
        .int()
        .min(0)
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

        const dimensionList: string[] = parseDimensionList(dimensions);

        const result = await provider.queryAnalytics({
          siteUrl: siteUrl.trim(),
          startDate: startDate.trim(),
          endDate: endDate.trim(),
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
          const note: string = result.note ? `\n\nNote: ${result.note}` : "";
          return okText(
            `No search analytics data found for **${siteUrl}** on **${provider.displayName}** between ${startDate} and ${endDate}.${note}`
          );
        }

        const columnHeaders: string[] = [
          ...result.columns.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)),
          "Clicks",
          "Impressions",
          "CTR",
          "Avg Position",
        ];

        const headerLine = `| ${columnHeaders.join(" | ")} |`;
        const separatorLine = `| ${columnHeaders.map(() => "---").join(" | ")} |`;

        const dataLines: string[] = result.rows.map((row) => {
          const keys: string[] = row.keys.map((k: string) => String(k).replace(/\|/g, "\\|"));
          while (keys.length < result.columns.length) {
            keys.push("-");
          }
          const ctr: string = Number.isFinite(row.ctr) ? ((row.ctr || 0) * 100).toFixed(2) + "%" : "0.00%";
          const pos: string = Number.isFinite(row.position) ? (row.position || 0).toFixed(1) : "0.0";
          const clicks: string = Number.isFinite(row.clicks) ? (row.clicks || 0).toLocaleString() : "0";
          const impressions: string = Number.isFinite(row.impressions)
            ? (row.impressions || 0).toLocaleString()
            : "0";

          return `| ${[...keys, clicks, impressions, ctr, pos].join(" | ")} |`;
        });

        const atLimit: boolean = result.rows.length >= result.effectiveLimit;
        const summaryCard: string = [
          `### Search Analytics: ${siteUrl} (${provider.displayName})`,
          `- **Date Range:** ${startDate} to ${endDate}`,
          `- **Rows Returned:** ${result.rows.length}${
            atLimit ? ` (reached effective limit of ${result.effectiveLimit})` : ""
          }`,
          `- **Total Clicks:** ${result.summary.totalClicks.toLocaleString()}`,
          `- **Total Impressions:** ${result.summary.totalImpressions.toLocaleString()}`,
          `- **Average CTR:** ${result.summary.overallCtr}`,
          `- **Average Position:** ${result.summary.overallPosition}`,
        ].join("\n");

        const noteBlock: string = result.note ? `\n\n> Note: ${result.note}` : "";
        const fullOutput = `${summaryCard}${noteBlock}\n\n${headerLine}\n${separatorLine}\n${dataLines.join("\n")}`;

        return okText(fullOutput);
      } catch (error: unknown) {
        return errText(`Error querying search analytics: ${getErrorMessage(error)}`);
      }
    }
  );
}
