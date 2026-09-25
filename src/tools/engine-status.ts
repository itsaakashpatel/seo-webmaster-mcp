import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { code, markdownTable } from "../core/markdown.js";
import { okText } from "../core/responses.js";
import { providers } from "../providers/index.js";
import {
  GOOGLE_INDEXING_SETUP_GUIDE,
  detectGoogleCredentials,
  isGoogleConfigured,
} from "../providers/google/auth.js";
import { INDEXNOW_SETUP_GUIDE, isIndexNowConfigured } from "../providers/indexnow/provider.js";
import { READ_ONLY, withErrorBoundary } from "./shared.js";

export interface EngineStatus {
  readonly name: string;
  readonly id: string;
  readonly configured: boolean;
  readonly authMethod: string;
  readonly guide: string;
}

function collectStatuses(): EngineStatus[] {
  const queryEngines = Object.values(providers).map((provider) => ({
    name: provider.displayName,
    id: provider.engine,
    configured: provider.isConfigured(),
    authMethod: provider.authMethod,
    guide: provider.getConfigurationGuide(),
  }));
  return [
    ...queryEngines,
    {
      name: "IndexNow (Instant Indexing)",
      id: "indexnow",
      configured: isIndexNowConfigured(),
      authMethod: "API Key (INDEXNOW_KEY)",
      guide: INDEXNOW_SETUP_GUIDE,
    },
    {
      name: "Google Indexing API (JobPosting/BroadcastEvent, 200/day)",
      id: "google-indexing",
      configured: isGoogleConfigured(),
      authMethod: "Service Account JSON + Indexing API enabled",
      guide: GOOGLE_INDEXING_SETUP_GUIDE,
    },
  ];
}

export function renderEngineStatus(statuses: readonly EngineStatus[]): string {
  const table = markdownTable(
    ["Provider", "Engine", "Status", "Auth Method"],
    statuses.map((s) => [
      s.name,
      code(s.id),
      s.configured ? "✅ Connected" : "❌ Not Configured",
      s.authMethod,
    ]),
  );
  const missing = statuses.filter((s) => !s.configured);
  const footer =
    missing.length === 0
      ? ["🎉 All search engine providers are properly configured and ready!"]
      : [
          "#### Setup Guides for Inactive Providers:\n",
          ...missing.map((s) => `**${s.name}:**\n${s.guide}\n`),
        ];
  return ["### Search Engine Provider Status\n", table, "", ...footer].join("\n");
}

export function registerEngineStatusTool(server: McpServer): void {
  server.registerTool(
    "engine_status",
    {
      title: "Engine Status",
      description:
        "Check the configuration and connection status of all integrated search engine providers (Google Search Console, Google Indexing API, Bing Webmaster Tools, IndexNow).",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    withErrorBoundary("Error checking engine status", async () => {
      await detectGoogleCredentials();
      return okText(renderEngineStatus(collectStatuses()));
    }),
  );
}
