import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { code } from "../core/markdown.js";
import { errText, okText } from "../core/responses.js";
import { GOOGLE_INDEXING_TYPES, type GoogleIndexingSubmissionResult } from "../core/types.js";
import { parseUrlList } from "../core/urls.js";
import { submitToGoogleIndexing } from "../providers/google/indexing.js";
import { SUBMIT, withErrorBoundary } from "./shared.js";

const MAX_LISTED_ITEMS = 20;

export function renderGoogleIndexingResult(res: GoogleIndexingSubmissionResult): string {
  const hidden = res.items.length - MAX_LISTED_ITEMS;
  return [
    "### Google Indexing API Submission",
    `- **Type:** ${code(res.notificationType)}`,
    `- **Submitted:** ${res.submittedCount}`,
    `- **Succeeded:** ${res.successCount}`,
    `- **Failed:** ${res.failureCount}`,
    "- **Eligibility:** Only JobPosting or BroadcastEvent (in VideoObject) pages are supported. Other pages return errors.",
    "- **Quota:** Default is 200 publish requests/day. 429 means quota exhausted; retry tomorrow.",
    "\n**Per-URL results:**",
    ...res.items
      .slice(0, MAX_LISTED_ITEMS)
      .map(
        (item) =>
          `- [${item.success ? "OK" : "FAIL"}] ${code(item.url)} (${item.statusCode}): ${item.message}`,
      ),
    ...(hidden > 0 ? [`- *...and ${hidden} more*`] : []),
  ].join("\n");
}

export function registerSubmitGoogleUrlsTool(server: McpServer): void {
  server.registerTool(
    "submit_urls_google",
    {
      title: "Submit URLs to Google Indexing API",
      description:
        "Notify Google about updated or deleted URLs via the Indexing API (JobPosting / BroadcastEvent pages only; default quota 200 URLs/day).",
      inputSchema: {
        urls: z
          .string()
          .min(1)
          .describe(
            "Comma-separated or newline-separated list of full https URLs (or JSON array). Max 200 per call.",
          ),
        type: z
          .enum(GOOGLE_INDEXING_TYPES)
          .optional()
          .default("URL_UPDATED")
          .describe(
            'Notification type: "URL_UPDATED" for new/changed pages, "URL_DELETED" for removed pages',
          ),
      },
      annotations: SUBMIT,
    },
    withErrorBoundary("Google indexing error", async ({ urls, type }) => {
      const res = await submitToGoogleIndexing({ urls: parseUrlList(urls), type });
      const text = renderGoogleIndexingResult(res);
      return res.successCount === 0 ? errText(text) : okText(text);
    }),
  );
}
