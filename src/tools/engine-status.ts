import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registry } from "../core/registry.js";
import { isIndexNowConfigured, getIndexNowConfigurationGuide } from "../providers/indexnow/provider.js";
import {
  isIndexingConfigured,
  getIndexingGuide,
} from "../providers/google/indexing.js";

export function registerEngineStatusTool(server: McpServer): void {
  server.tool(
    "engine_status",
    "Check the configuration and connection status of all integrated search engine providers (Google Search Console, Google Indexing API, Bing Webmaster Tools, IndexNow).",
    {},
    async () => {
      const providers = registry.getAll();
      const lines: string[] = [];

      lines.push("### Search Engine Provider Status\n");
      lines.push("| Provider | Engine | Status | Auth Method |");
      lines.push("| --- | --- | --- | --- |");

      for (const p of providers) {
        const configured = p.isConfigured();
        const statusBadge = configured ? "✅ Connected" : "❌ Not Configured";
        const authMethod =
          p.engine === "google"
            ? "Service Account JSON / ADC"
            : p.engine === "bing"
            ? "API Key (BING_WEBMASTER_API_KEY)"
            : "Unknown";

        lines.push(`| ${p.displayName} | \`${p.engine}\` | ${statusBadge} | ${authMethod} |`);
      }

      const indexNowStatus = isIndexNowConfigured() ? "✅ Connected" : "❌ Not Configured";
      lines.push(
        `| IndexNow (Instant Indexing) | \`indexnow\` | ${indexNowStatus} | API Key (INDEXNOW_KEY) |`
      );

      const indexingStatus = isIndexingConfigured() ? "✅ Connected" : "❌ Not Configured";
      lines.push(
        `| Google Indexing API (JobPosting/BroadcastEvent, 200/day) | \`google-indexing\` | ${indexingStatus} | Service Account JSON + Indexing API enabled |`
      );

      lines.push("");

      // Provide setup tips for unconfigured engines
      const unconfigured = providers.filter((p) => !p.isConfigured());
      const indexingMissing: boolean = !isIndexingConfigured();
      if (unconfigured.length > 0 || !isIndexNowConfigured() || indexingMissing) {
        lines.push("#### Setup Guides for Inactive Providers:\n");
        for (const p of unconfigured) {
          lines.push(`**${p.displayName}:**`);
          lines.push(p.getConfigurationGuide());
          lines.push("");
        }
        if (!isIndexNowConfigured()) {
          lines.push("**IndexNow:**");
          lines.push(getIndexNowConfigurationGuide());
          lines.push("");
        }
        if (indexingMissing) {
          lines.push("**Google Indexing API:**");
          lines.push(getIndexingGuide());
          lines.push("");
        }
      } else {
        lines.push("🎉 All search engine providers are properly configured and ready!");
      }

      return {
        content: [
          {
            type: "text",
            text: lines.join("\n"),
          },
        ],
      };
    }
  );
}
