import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { code, fieldList } from "../core/markdown.js";
import { okText } from "../core/responses.js";
import type {
  Issue,
  MobileUsability,
  RichResultGroup,
  RichResults,
  UrlInspectionResult,
} from "../core/types.js";
import { isHttpUrl } from "../core/urls.js";
import { providers } from "../providers/index.js";
import { READ_ONLY, engineSchema, siteUrlSchema, withErrorBoundary } from "./shared.js";

const MAX_REFERRING_URLS = 5;

function severityPrefix(issue: Issue): string {
  return issue.severity ? `[${issue.severity}] ` : "";
}

function optionalCode(value: string | undefined): string | undefined {
  return value === undefined ? undefined : code(value);
}

function renderIndexStatus(res: UrlInspectionResult): string[] {
  const sitemaps = res.sitemaps?.length ? res.sitemaps.map(code).join(", ") : undefined;
  const referring = (res.referringUrls ?? [])
    .slice(0, MAX_REFERRING_URLS)
    .map((url) => `  - ${code(url)}`);
  return [
    "### Indexing Status",
    ...fieldList([
      ["Overall Verdict", code(res.verdict)],
      ["Coverage State", res.coverageState],
      ["Indexing State", res.indexingState],
      ["Page Fetch", res.pageFetchState],
      ["Robots.txt", res.robotsTxtState],
      ["Last Crawled", res.lastCrawlTime],
      [
        "Site Last Crawled",
        res.siteLastCrawlTime && `${res.siteLastCrawlTime} (site-level crawl context)`,
      ],
      ["Crawled As", res.crawledAs],
      ["User Canonical", optionalCode(res.userCanonical)],
      ["Google Canonical", optionalCode(res.googleCanonical)],
      ["Sitemaps", sitemaps],
    ]),
    ...(referring.length > 0 ? ["- **Referring URLs:**", ...referring] : []),
    "",
  ];
}

function renderMobileUsability(mobile: MobileUsability): string[] {
  const issues = mobile.issues.map(
    (issue) => `  - ${severityPrefix(issue)}**${issue.issueType}**: ${issue.message ?? ""}`,
  );
  const fallback =
    mobile.verdict === "UNKNOWN"
      ? "- Verdict unknown; provider did not return mobile data."
      : "- No mobile usability issues found.";
  return [
    "### Mobile Usability",
    `- **Verdict:** ${code(mobile.verdict)}`,
    ...(issues.length > 0 ? ["- **Issues Detected:**", ...issues] : [fallback]),
    "",
  ];
}

function renderRichResultGroup(group: RichResultGroup): string[] {
  const items = group.items.flatMap((item) =>
    item.issues.length > 0
      ? item.issues.map(
          (issue) => `    - ${severityPrefix(issue)}${issue.message || "Schema issue"}`,
        )
      : [`    - Valid${item.name ? ` (${item.name})` : ""}`],
  );
  return [`  - **${group.type}**:`, ...items];
}

function renderRichResults(rich: RichResults): string[] {
  const groups = rich.detectedItems.flatMap(renderRichResultGroup);
  return [
    "### Rich Results (Structured Data)",
    `- **Verdict:** ${code(rich.verdict)}`,
    ...(groups.length > 0
      ? ["- **Detected Schema Items:**", ...groups]
      : ["- No rich result items detected on this URL."]),
  ];
}

export function renderInspection(res: UrlInspectionResult, providerName: string): string {
  return [
    `## URL Inspection: ${code(res.inspectionUrl)}`,
    `- **Provider:** ${providerName}`,
    `- **Property:** ${code(res.siteUrl)}`,
    "",
    ...renderIndexStatus(res),
    ...(res.mobileUsability ? renderMobileUsability(res.mobileUsability) : []),
    ...(res.richResults ? renderRichResults(res.richResults) : []),
  ].join("\n");
}

export function registerInspectUrlTool(server: McpServer): void {
  server.registerTool(
    "inspect_url",
    {
      title: "Inspect URL",
      description:
        "Inspect a URL in Google Search Console or Bing Webmaster Tools to check live indexing status, crawl info, canonical URLs, mobile usability, and rich results (schema validation). Note: Bing does not offer URL-level inspection; Bing returns UNKNOWN with crawl context only.",
      inputSchema: {
        siteUrl: siteUrlSchema,
        inspectionUrl: z
          .string()
          .trim()
          .refine(isHttpUrl, "inspectionUrl must be a full http(s) URL")
          .describe("The fully qualified URL to inspect (must belong to the site property)"),
        engine: engineSchema,
        languageCode: z
          .string()
          .optional()
          .describe("Language code for issue messages (e.g. 'en-US')"),
      },
      annotations: READ_ONLY,
    },
    withErrorBoundary(
      "Error inspecting URL",
      async ({ siteUrl, inspectionUrl, engine, languageCode }) => {
        const provider = providers[engine];
        const res = await provider.inspectUrl(siteUrl, inspectionUrl, languageCode);
        return okText(renderInspection(res, provider.displayName));
      },
    ),
  );
}
