import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registry } from "../core/registry.js";
import { SiteInfo, EngineType } from "../core/types.js";
import { getErrorMessage } from "../core/errors.js";
import { okText, errText } from "../core/responses.js";

function toEngine(value: string): EngineType | undefined {
  if (value === "google" || value === "bing") {
    return value;
  }
  return undefined;
}

export function registerListSitesTool(server: McpServer): void {
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
        const targetEngines: EngineType[] =
          engine === "all" ? ["google", "bing"] : [];
        if (engine !== "all") {
          const single: EngineType | undefined = toEngine(engine);
          if (!single) {
            throw new Error(`Unknown engine "${engine}".`);
          }
          targetEngines.push(single);
        }

        const allSites: SiteInfo[] = [];
        const errors: string[] = [];

        for (const eng of targetEngines) {
          const provider = registry.get(eng);
          if (!provider) continue;

          try {
            const sites: SiteInfo[] = await provider.listSites();
            allSites.push(...sites);
          } catch (err: unknown) {
            errors.push(`**${provider.displayName}:** ${getErrorMessage(err)}`);
          }
        }

        if (allSites.length === 0 && errors.length > 0) {
          return errText(`Failed to retrieve sites:\n\n${errors.join("\n\n")}`);
        }

        if (allSites.length === 0) {
          return okText(
            "No sites found on any configured search engine.\n\nMake sure your credentials / API keys have verified properties."
          );
        }

        const lines: string[] = [];
        lines.push(`### Verified Properties (${allSites.length})\n`);
        lines.push("| Engine | Site URL | Permission / Role |");
        lines.push("| --- | --- | --- |");

        for (const s of allSites) {
          const badge: string = s.engine === "google" ? "Google" : "Bing";
          lines.push(`| **${badge}** | \`${s.siteUrl}\` | ${s.permissionLevel} |`);
        }

        if (errors.length > 0) {
          lines.push("\n> **Provider Warnings:**");
          for (const e of errors) {
            lines.push(`> - ${e}`);
          }
        }

        lines.push(
          "\n*Note: Use the exact Site URL (e.g. `sc-domain:example.com` or `https://example.com/`) when querying search analytics or inspecting URLs.*"
        );

        return okText(lines.join("\n"));
      } catch (error: unknown) {
        return errText(`Error listing sites: ${getErrorMessage(error)}`);
      }
    }
  );
}
