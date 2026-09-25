import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registry } from "../core/registry.js";
import { getErrorMessage } from "../core/errors.js";
import { okText, errText } from "../core/responses.js";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function registerInspectUrlTool(server: McpServer): void {
  server.tool(
    "inspect_url",
    "Inspect a URL in Google Search Console or Bing Webmaster Tools to check live indexing status, crawl info, canonical URLs, mobile usability, and rich results (schema validation). Note: Bing does not offer URL-level inspection; Bing returns UNKNOWN with crawl context only.",
    {
      siteUrl: z
        .string()
        .min(1)
        .describe(
          "Site URL as verified in Search Console (e.g. https://example.com/ or sc-domain:example.com)",
        ),
      inspectionUrl: z
        .string()
        .min(1)
        .refine((v: string) => isHttpUrl(v), "inspectionUrl must be a full http(s) URL")
        .describe("The fully qualified URL to inspect (must belong to the site property)"),
      engine: z
        .enum(["google", "bing"])
        .optional()
        .default("google")
        .describe("Search engine to inspect on: 'google' or 'bing' (default: 'google')"),
      languageCode: z
        .string()
        .optional()
        .describe("Language code for issue messages (e.g. 'en-US')"),
    },
    async ({ siteUrl, inspectionUrl, engine, languageCode }) => {
      try {
        const cleanSite: string = siteUrl.trim();
        const cleanUrl: string = inspectionUrl.trim();
        if (cleanSite.length === 0) {
          throw new Error("siteUrl must be non-empty.");
        }
        const provider = registry.get(engine);
        if (!provider) {
          throw new Error(`Provider "${engine}" is not registered.`);
        }

        if (!provider.inspectUrl) {
          throw new Error(`URL inspection is not supported by ${provider.displayName}.`);
        }

        const res = await provider.inspectUrl(cleanSite, cleanUrl, languageCode);
        const lines: string[] = [];

        lines.push(`## URL Inspection: \`${res.inspectionUrl}\``);
        lines.push(`- **Provider:** ${provider.displayName}`);
        lines.push(`- **Property:** \`${res.siteUrl}\``);
        lines.push("");

        lines.push("### Indexing Status");
        lines.push(`- **Overall Verdict:** \`${res.verdict}\``);
        if (res.coverageState) lines.push(`- **Coverage State:** ${res.coverageState}`);
        if (res.indexingState) lines.push(`- **Indexing State:** ${res.indexingState}`);
        if (res.pageFetchState) lines.push(`- **Page Fetch:** ${res.pageFetchState}`);
        if (res.robotsTxtState) lines.push(`- **Robots.txt:** ${res.robotsTxtState}`);
        if (res.lastCrawlTime) lines.push(`- **Last Crawled:** ${res.lastCrawlTime}`);
        if (res.siteLastCrawlTime) {
          lines.push(
            `- **Site Last Crawled:** ${res.siteLastCrawlTime} (site-level crawl context)`,
          );
        }
        if (res.crawledAs) lines.push(`- **Crawled As:** ${res.crawledAs}`);
        if (res.userCanonical) lines.push(`- **User Canonical:** \`${res.userCanonical}\``);
        if (res.googleCanonical) lines.push(`- **Google Canonical:** \`${res.googleCanonical}\``);
        if (res.sitemaps && res.sitemaps.length > 0) {
          lines.push(`- **Sitemaps:** ${res.sitemaps.map((s: string) => `\`${s}\``).join(", ")}`);
        }
        if (res.referringUrls && res.referringUrls.length > 0) {
          lines.push("- **Referring URLs:**");
          for (const r of res.referringUrls.slice(0, 5)) {
            lines.push(`  - \`${r}\``);
          }
        }
        lines.push("");

        if (res.mobileUsability) {
          lines.push("### Mobile Usability");
          lines.push(`- **Verdict:** \`${res.mobileUsability.verdict}\``);
          if (res.mobileUsability.issues && res.mobileUsability.issues.length > 0) {
            lines.push("- **Issues Detected:**");
            for (const issue of res.mobileUsability.issues) {
              const sev: string = issue.severity ? `[${issue.severity}] ` : "";
              lines.push(`  - ${sev}**${issue.issueType}**: ${issue.message || ""}`);
            }
          } else if (res.mobileUsability.verdict === "UNKNOWN") {
            lines.push("- Verdict unknown; provider did not return mobile data.");
          } else {
            lines.push("- No mobile usability issues found.");
          }
          lines.push("");
        }

        if (res.richResults) {
          lines.push("### Rich Results (Structured Data)");
          lines.push(`- **Verdict:** \`${res.richResults.verdict}\``);
          if (res.richResults.detectedItems && res.richResults.detectedItems.length > 0) {
            lines.push("- **Detected Schema Items:**");
            for (const itemGroup of res.richResults.detectedItems) {
              lines.push(`  - **${itemGroup.type}**:`);
              if (itemGroup.items && itemGroup.items.length > 0) {
                for (const item of itemGroup.items) {
                  const nameStr: string = item.name ? ` (${item.name})` : "";
                  if (item.issues && item.issues.length > 0) {
                    for (const iss of item.issues) {
                      const sev: string = iss.severity ? `[${iss.severity}] ` : "";
                      lines.push(`    - ${sev}${iss.message || "Schema issue"}`);
                    }
                  } else {
                    lines.push(`    - Valid${nameStr}`);
                  }
                }
              }
            }
          } else {
            lines.push("- No rich result items detected on this URL.");
          }
        }

        return okText(lines.join("\n"));
      } catch (error: unknown) {
        return errText(`Error inspecting URL: ${getErrorMessage(error)}`);
      }
    },
  );
}
