import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registry } from "../core/registry.js";
import { getErrorMessage } from "../core/errors.js";
import { okText, errText } from "../core/responses.js";

export function registerGetSitemapTool(server: McpServer): void {
  server.tool(
    "get_sitemap",
    "Retrieve deep indexing and error metrics for a specific sitemap feed.",
    {
      siteUrl: z.string().min(1).describe("Site URL as verified in Search Console"),
      feedpath: z
        .string()
        .min(1)
        .describe(
          "Full URL or relative path to the sitemap (e.g. https://example.com/sitemap.xml)",
        ),
      engine: z
        .enum(["google", "bing"])
        .optional()
        .default("google")
        .describe("Search engine provider: 'google' or 'bing' (default: 'google')"),
    },
    async ({ siteUrl, feedpath, engine }) => {
      try {
        const provider = registry.get(engine);
        if (!provider) {
          throw new Error(`Provider "${engine}" is not registered.`);
        }

        if (!provider.getSitemap) {
          throw new Error(`Getting sitemap details is not supported by ${provider.displayName}.`);
        }

        const sm = await provider.getSitemap(siteUrl.trim(), feedpath.trim());
        const lines: string[] = [];

        lines.push(`### Sitemap Details: \`${sm.path}\``);
        lines.push(`- **Provider:** ${provider.displayName}`);
        lines.push(`- **Site:** \`${siteUrl}\``);
        lines.push(`- **Type:** ${sm.type || "Sitemap"}`);
        lines.push(`- **Status:** ${sm.status || "Unknown"}`);
        lines.push(`- **Last Submitted:** ${sm.lastSubmitted || "Never"}`);
        lines.push(`- **Last Downloaded:** ${sm.lastDownloaded || "Never"}`);
        lines.push(`- **Errors:** ${sm.errors || 0}`);
        lines.push(`- **Warnings:** ${sm.warnings || 0}`);

        if (sm.contents && sm.contents.length > 0) {
          lines.push("\n#### Contents Breakdown:");
          for (const c of sm.contents) {
            lines.push(
              `- **${c.type}**: ${c.indexed.toLocaleString()} indexed / ${c.submitted.toLocaleString()} submitted`,
            );
          }
        }

        return okText(lines.join("\n"));
      } catch (error: unknown) {
        return errText(`Error getting sitemap details: ${getErrorMessage(error)}`);
      }
    },
  );
}
