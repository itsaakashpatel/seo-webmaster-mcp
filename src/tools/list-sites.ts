import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registry } from "../core/registry.js";
import { SiteInfo } from "../core/types.js";

export function registerListSitesTool(server: McpServer) {
  server.tool(
    "list_sites",
    "List all verified sites (properties) across Google Search Console and Bing Webmaster Tools, along with permission levels.",
    {
      engine: z
        .enum(["all", "google", "bing"])
        .optional()
        .default("all")
        .describe("Search engine to list properties for: 'google', 'bing', or 'all' (default: 'all')"),
    },
    async ({ engine }) => {
      try {
        const targetEngines =
          engine === "all" ? ["google", "bing"] : [engine];

        const allSites: SiteInfo[] = [];
        const errors: string[] = [];

        for (const eng of targetEngines) {
          const provider = registry.get(eng as any);
          if (!provider) continue;

          try {
            const sites = await provider.listSites();
            allSites.push(...sites);
          } catch (err: any) {
            errors.push(`**${provider.displayName}:** ${err.message}`);
          }
        }

        if (allSites.length === 0 && errors.length > 0) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Failed to retrieve sites:\n\n${errors.join("\n\n")}`,
              },
            ],
          };
        }

        if (allSites.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No sites found on any configured search engine.\n\nMake sure your credentials / API keys have verified properties.",
              },
            ],
          };
        }

        const lines: string[] = [];
        lines.push(`### Verified Properties (${allSites.length})\n`);
        lines.push("| Engine | Site URL | Permission / Role |");
        lines.push("| --- | --- | --- |");

        for (const s of allSites) {
          const badge = s.engine === "google" ? "Google" : "Bing";
          lines.push(`| **${badge}** | \`${s.siteUrl}\` | ${s.permissionLevel} |`);
        }

        if (errors.length > 0) {
          lines.push("\n> ⚠️ **Provider Warnings:**");
          for (const e of errors) {
            lines.push(`> - ${e}`);
          }
        }

        lines.push(
          "\n*Note: Use the exact Site URL (e.g. `sc-domain:example.com` or `https://example.com/`) when querying search analytics or inspecting URLs.*"
        );

        return {
          content: [
            {
              type: "text",
              text: lines.join("\n"),
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing sites: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}
