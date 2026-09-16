import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registry } from "../core/registry.js";

export function registerSitemapsTools(server: McpServer) {
  server.tool(
    "list_sitemaps",
    "List all submitted sitemaps and their current status, last download date, error counts, and indexed URL counts.",
    {
      siteUrl: z
        .string()
        .describe("Site URL as verified in Search Console"),
      engine: z
        .enum(["google", "bing"])
        .optional()
        .default("google")
        .describe("Search engine provider: 'google' or 'bing' (default: 'google')"),
    },
    async ({ siteUrl, engine }) => {
      try {
        const provider = registry.get(engine);
        if (!provider) {
          throw new Error(`Provider "${engine}" is not registered.`);
        }

        if (!provider.listSitemaps) {
          throw new Error(`Sitemap listing is not supported by ${provider.displayName}.`);
        }

        const sitemaps = await provider.listSitemaps(siteUrl);

        if (sitemaps.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No sitemaps found for **${siteUrl}** on ${provider.displayName}.`,
              },
            ],
          };
        }

        const lines: string[] = [];
        lines.push(`### Sitemaps for \`${siteUrl}\` (${provider.displayName})\n`);

        const tableHeader =
          "| Sitemap Path | Last Submitted | Last Crawled | Type | Errors | Status |";
        const tableSeparator =
          "| --- | --- | --- | --- | --- | --- |";

        const tableRows = sitemaps.map((sm) => {
          const path = `\`${sm.path}\``;
          const lastSub = sm.lastSubmitted ? sm.lastSubmitted.split("T")[0] : "never";
          const lastDown = sm.lastDownloaded ? sm.lastDownloaded.split("T")[0] : "never";
          const type = sm.type || "Sitemap";
          const errors = sm.errors || 0;
          const status = sm.status || "Unknown";

          return `| ${path} | ${lastSub} | ${lastDown} | ${type} | ${errors} | ${status} |`;
        });

        lines.push(tableHeader);
        lines.push(tableSeparator);
        lines.push(...tableRows);

        // Content breakdown
        const withContents = sitemaps.filter((sm) => sm.contents && sm.contents.length > 0);
        if (withContents.length > 0) {
          lines.push("\n#### Indexed vs Submitted URLs:");
          for (const sm of withContents) {
            lines.push(`\n**\`${sm.path}\`**:`);
            for (const c of sm.contents || []) {
              lines.push(`- **${c.type}**: ${c.indexed.toLocaleString()} indexed / ${c.submitted.toLocaleString()} submitted`);
            }
          }
        }

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
              text: `Error listing sitemaps: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "get_sitemap",
    "Retrieve deep indexing and error metrics for a specific sitemap feed.",
    {
      siteUrl: z
        .string()
        .describe("Site URL as verified in Search Console"),
      feedpath: z
        .string()
        .describe("Full URL or relative path to the sitemap (e.g. https://example.com/sitemap.xml)"),
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

        const sm = await provider.getSitemap(siteUrl, feedpath);
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
            lines.push(`- **${c.type}**: ${c.indexed.toLocaleString()} indexed / ${c.submitted.toLocaleString()} submitted`);
          }
        }

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
              text: `Error getting sitemap details: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}
