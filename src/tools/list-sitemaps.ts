import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registry } from "../core/registry.js";
import { getErrorMessage } from "../core/errors.js";
import { okText, errText } from "../core/responses.js";

export function registerListSitemapsTool(server: McpServer): void {
  server.tool(
    "list_sitemaps",
    "List all submitted sitemaps and their current status, last download date, error counts, and indexed URL counts.",
    {
      siteUrl: z.string().min(1).describe("Site URL as verified in Search Console"),
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

        const sitemaps = await provider.listSitemaps(siteUrl.trim());

        if (sitemaps.length === 0) {
          return okText(`No sitemaps found for **${siteUrl}** on ${provider.displayName}.`);
        }

        const lines: string[] = [];
        lines.push(`### Sitemaps for \`${siteUrl}\` (${provider.displayName})\n`);

        const tableHeader =
          "| Sitemap Path | Last Submitted | Last Crawled | Type | Errors | Status |";
        const tableSeparator = "| --- | --- | --- | --- | --- | --- |";

        const tableRows = sitemaps.map((sm) => {
          const path = `\`${sm.path}\``;
          const lastSub = sm.lastSubmitted ? sm.lastSubmitted.split("T")[0] : "never";
          const lastDown = sm.lastDownloaded ? sm.lastDownloaded.split("T")[0] : "never";
          const type = sm.type || "Sitemap";
          const errors = sm.errors !== undefined ? sm.errors : "-";
          const status = sm.status || "Unknown";

          return `| ${path} | ${lastSub} | ${lastDown} | ${type} | ${errors} | ${status} |`;
        });

        lines.push(tableHeader);
        lines.push(tableSeparator);
        lines.push(...tableRows);

        const withBreakdown = sitemaps.filter(
          (sm) => (sm.contents && sm.contents.length > 0) || sm.submittedUrls !== undefined,
        );
        if (withBreakdown.length > 0) {
          lines.push("\n#### Indexed vs Submitted URLs:");
          for (const sm of withBreakdown) {
            lines.push(`\n**\`${sm.path}\`**:`);
            if (sm.contents && sm.contents.length > 0) {
              for (const c of sm.contents) {
                lines.push(
                  `- **${c.type}**: ${c.indexed.toLocaleString()} indexed / ${c.submitted.toLocaleString()} submitted`,
                );
              }
            } else if (sm.submittedUrls !== undefined) {
              lines.push(`- **Submitted URLs**: ${sm.submittedUrls.toLocaleString()}`);
            }
          }
        }

        return okText(lines.join("\n"));
      } catch (error: unknown) {
        return errText(`Error listing sitemaps: ${getErrorMessage(error)}`);
      }
    },
  );
}
