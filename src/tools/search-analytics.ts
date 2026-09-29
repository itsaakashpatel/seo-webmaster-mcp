import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatCount, formatPercent, markdownTable } from "../core/markdown.js";
import { okText } from "../core/responses.js";
import { DATA_STATES, DEVICES, SEARCH_TYPES, type AnalyticsResult } from "../core/types.js";
import { parseDimensionList } from "../core/validation.js";
import { providers } from "../providers/index.js";
import { READ_ONLY, engineSchema, siteUrlSchema, withErrorBoundary } from "./shared.js";

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const FILTER_HELP =
  "plain text (contains), '!text' (not contains), 'exact:value', '!exact:value', 'regex:pattern', or '!regex:pattern' (RE2 syntax)";

const inputSchema = {
  siteUrl: siteUrlSchema,
  startDate: dateSchema.describe("Start date in YYYY-MM-DD format (e.g. 2026-08-01)"),
  endDate: dateSchema.describe("End date in YYYY-MM-DD format (e.g. 2026-08-28)"),
  engine: engineSchema,
  dimensions: z
    .string()
    .optional()
    .describe(
      "Comma-separated dimensions to group by: query, page, country, device, searchAppearance, date. Default: 'query'",
    ),
  rowLimit: z
    .number()
    .int()
    .min(1)
    .max(25_000)
    .optional()
    .default(100)
    .describe("Max rows to return (default 100, maximum 25000; Bing caps at 5000)"),
  searchType: z
    .enum(SEARCH_TYPES)
    .optional()
    .default("web")
    .describe("Search vertical: web, image, video, news, discover, googleNews (default: web)"),
  dataState: z
    .enum(DATA_STATES)
    .optional()
    .default("all")
    .describe(
      "Data freshness (Google): 'all' includes fresh (recent ~2 days) data, 'final' only finalized",
    ),
  queryFilter: z.string().max(200).optional().describe(`Filter queries: ${FILTER_HELP}`),
  pageFilter: z.string().max(200).optional().describe(`Filter page URLs: ${FILTER_HELP}`),
  countryFilter: z
    .string()
    .regex(/^[A-Za-z]{3}$/, "Use ISO 3166-1 alpha-3 (e.g. USA, GBR)")
    .optional()
    .describe("Filter by ISO 3166-1 alpha-3 country code (e.g. USA, GBR, IND, DEU)"),
  deviceFilter: z.enum(DEVICES).optional().describe("Filter by device: DESKTOP, MOBILE, or TABLET"),
  startRow: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe("Zero-based row offset for pagination"),
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function renderAnalytics(result: AnalyticsResult, providerName: string): string {
  const header = [
    ...result.columns.map(capitalize),
    "Clicks",
    "Impressions",
    "CTR",
    "Avg Position",
  ];
  const rows = result.rows.map((row) => [
    ...result.columns.map((_, index) => row.keys[index] ?? "-"),
    formatCount(row.clicks),
    formatCount(row.impressions),
    formatPercent(row.ctr),
    row.position.toFixed(1),
  ]);
  const limitNote =
    result.rows.length >= result.effectiveLimit
      ? ` (reached effective limit of ${result.effectiveLimit})`
      : "";
  const summary = [
    `### Search Analytics: ${result.siteUrl} (${providerName})`,
    `- **Date Range:** ${result.startDate} to ${result.endDate}`,
    `- **Rows Returned:** ${result.rows.length}${limitNote}`,
    `- **Total Clicks:** ${formatCount(result.summary.totalClicks)}`,
    `- **Total Impressions:** ${formatCount(result.summary.totalImpressions)}`,
    `- **Average CTR:** ${result.summary.overallCtr}`,
    `- **Average Position:** ${result.summary.overallPosition}`,
  ];
  const note = result.note ? [`\n> Note: ${result.note}`] : [];
  return [...summary, ...note, "", markdownTable(header, rows)].join("\n");
}

function renderEmpty(result: AnalyticsResult, providerName: string): string {
  const note = result.note ? `\n\nNote: ${result.note}` : "";
  return `No search analytics data found for **${result.siteUrl}** on **${providerName}** between ${result.startDate} and ${result.endDate}.${note}`;
}

export function registerSearchAnalyticsTool(server: McpServer): void {
  server.registerTool(
    "search_analytics",
    {
      title: "Search Analytics",
      description:
        "Query search performance and analytics data (clicks, impressions, CTR, average position) across Google Search Console or Bing Webmaster Tools.",
      inputSchema,
      annotations: READ_ONLY,
    },
    withErrorBoundary(
      "Error querying search analytics",
      async ({ engine, dimensions, ...query }) => {
        const provider = providers[engine];
        const result = await provider.queryAnalytics({
          ...query,
          dimensions: parseDimensionList(dimensions),
        });
        const render = result.rows.length === 0 ? renderEmpty : renderAnalytics;
        return okText(render(result, provider.displayName));
      },
    ),
  );
}
