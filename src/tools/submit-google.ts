import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  submitToGoogleIndexing,
  GOOGLE_INDEXING_QUOTA_PER_DAY,
} from "../providers/google/indexing.js";
import { getErrorMessage } from "../core/errors.js";
import { parseUrlList } from "../core/urls.js";
import { okText, errText } from "../core/responses.js";
import { GoogleIndexingType } from "../core/types.js";

function toIndexingType(value: string): GoogleIndexingType {
  if (value === "URL_UPDATED" || value === "URL_DELETED") {
    return value;
  }
  throw new Error(`Invalid type "${value}". Use "URL_UPDATED" or "URL_DELETED".`);
}

export function registerSubmitGoogleUrlsTool(server: McpServer): void {
  server.tool(
    "submit_urls_google",
    "Notify Google about updated or deleted URLs via the Indexing API (JobPosting / BroadcastEvent pages only; default quota 200 URLs/day).",
    {
      urls: z
        .string()
        .min(1)
        .describe(
          "Comma-separated or newline-separated list of full https URLs (or JSON array). Max 200 per call."
        ),
      type: z
        .enum(["URL_UPDATED", "URL_DELETED"])
        .optional()
        .default("URL_UPDATED")
        .describe('Notification type: "URL_UPDATED" for new/changed pages, "URL_DELETED" for removed pages'),
    },
    async ({ urls, type }) => {
      try {
        let parsed: string[];
        try {
          parsed = parseUrlList(urls);
        } catch (err: unknown) {
          return errText(`Invalid urls input: ${getErrorMessage(err)}`);
        }
        if (parsed.length === 0) {
          return errText("No valid URLs provided to submit.");
        }
        if (parsed.length > GOOGLE_INDEXING_QUOTA_PER_DAY) {
          return errText(
            `Too many URLs (${parsed.length}). Max ${GOOGLE_INDEXING_QUOTA_PER_DAY} per call; default daily quota is 200. Split into smaller batches.`
          );
        }

        const res = await submitToGoogleIndexing({
          urls: parsed,
          type: toIndexingType(type),
        });

        const lines: string[] = [];
        lines.push("### Google Indexing API Submission");
        lines.push(`- **Type:** \`${res.notificationType}\``);
        lines.push(`- **Submitted:** ${res.submittedCount}`);
        lines.push(`- **Succeeded:** ${res.successCount}`);
        lines.push(`- **Failed:** ${res.failureCount}`);
        lines.push(
          `- **Eligibility:** Only JobPosting or BroadcastEvent (in VideoObject) pages are supported. Other pages return errors.`
        );
        lines.push(
          `- **Quota:** Default is 200 publish requests/day. 429 means quota exhausted; retry tomorrow.`
        );
        lines.push("\n**Per-URL results:**");
        for (const item of res.items.slice(0, 20)) {
          const icon: string = item.success ? "OK" : "FAIL";
          lines.push(`- [${icon}] \`${item.url}\` (${item.statusCode}): ${item.message}`);
        }
        if (res.items.length > 20) {
          lines.push(`- *...and ${res.items.length - 20} more*`);
        }
        const hasFailures: boolean = res.failureCount > 0;

        if (hasFailures && res.successCount === 0) {
          return errText(lines.join("\n"));
        }
        return okText(lines.join("\n"));
      } catch (error: unknown) {
        return errText(`Google indexing error: ${getErrorMessage(error)}`);
      }
    }
  );
}
