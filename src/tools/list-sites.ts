import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getErrorMessage } from "../core/errors.js";
import { code, markdownTable } from "../core/markdown.js";
import { errText, okText, type ToolResult } from "../core/responses.js";
import { QUERY_ENGINES, type QueryEngineType, type SiteInfo } from "../core/types.js";
import { providers } from "../providers/index.js";
import { READ_ONLY, withErrorBoundary } from "./shared.js";

const ENGINE_LABELS: Readonly<Record<QueryEngineType, string>> = { google: "Google", bing: "Bing" };

const SITE_URL_TIP =
  "*Note: Use the exact Site URL (e.g. `sc-domain:example.com` or `https://example.com/`) when querying search analytics or inspecting URLs.*";

export function renderSites(sites: readonly SiteInfo[], warnings: readonly string[]): string {
  const table = markdownTable(
    ["Engine", "Site URL", "Permission / Role"],
    sites.map((site) => [
      `**${ENGINE_LABELS[site.engine]}**`,
      code(site.siteUrl),
      site.permissionLevel,
    ]),
  );
  const warningBlock =
    warnings.length > 0
      ? ["\n> **Provider Warnings:**", ...warnings.map((warning) => `> - ${warning}`)]
      : [];
  return [
    `### Verified Properties (${sites.length})\n`,
    table,
    ...warningBlock,
    `\n${SITE_URL_TIP}`,
  ].join("\n");
}

/** Lists sites on every requested engine in parallel. One failing engine does not hide the rest. */
async function listSites(engines: readonly QueryEngineType[]): Promise<ToolResult> {
  const results = await Promise.allSettled(engines.map((engine) => providers[engine].listSites()));
  const sites = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const warnings = results.flatMap((result, index) => {
    const engine = engines[index];
    return result.status === "rejected" && engine
      ? [`**${providers[engine].displayName}:** ${getErrorMessage(result.reason)}`]
      : [];
  });
  if (sites.length > 0) {
    return okText(renderSites(sites, warnings));
  }
  return warnings.length > 0
    ? errText(`Failed to retrieve sites:\n\n${warnings.join("\n\n")}`)
    : okText(
        "No sites found on any configured search engine.\n\nMake sure your credentials / API keys have verified properties.",
      );
}

export function registerListSitesTool(server: McpServer): void {
  server.registerTool(
    "list_sites",
    {
      title: "List Sites",
      description:
        "List all verified sites (properties) across Google Search Console and Bing Webmaster Tools, along with permission levels.",
      inputSchema: {
        engine: z
          .enum(["all", ...QUERY_ENGINES])
          .optional()
          .default("all")
          .describe(
            "Search engine to list properties for: 'google', 'bing', or 'all' (default: 'all')",
          ),
      },
      annotations: READ_ONLY,
    },
    withErrorBoundary("Error listing sites", ({ engine }) =>
      listSites(engine === "all" ? QUERY_ENGINES : [engine]),
    ),
  );
}
