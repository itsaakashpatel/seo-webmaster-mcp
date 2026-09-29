import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { code } from "../core/markdown.js";
import { okText } from "../core/responses.js";
import type { IndexNowSubmissionResult } from "../core/types.js";
import { parseUrlList } from "../core/urls.js";
import { submitToIndexNow } from "../providers/indexnow/provider.js";
import { SUBMIT, withErrorBoundary } from "./shared.js";

const MAX_LISTED_URLS = 10;

export function renderIndexNowResult(res: IndexNowSubmissionResult): string {
  const hidden = res.urlList.length - MAX_LISTED_URLS;
  return [
    "### IndexNow URL Submission Successful",
    `- **Host:** ${code(res.host)}`,
    `- **URLs Submitted:** ${res.submittedCount}`,
    `- **Status:** ${res.statusCode} (${res.statusMessage})`,
    "- **Target Engines:** Bing, Yandex, Seznam, Naver",
    "\n**Submitted URLs:**",
    ...res.urlList.slice(0, MAX_LISTED_URLS).map((url) => `- ${code(url)}`),
    ...(hidden > 0 ? [`- *...and ${hidden} more URLs*`] : []),
  ].join("\n");
}

export function registerSubmitUrlsTool(server: McpServer): void {
  server.registerTool(
    "submit_urls_indexnow",
    {
      title: "Submit URLs to IndexNow",
      description:
        "Instantly notify Bing, Yandex, Seznam, and other IndexNow search engines about added, updated, or deleted URLs on your website.",
      inputSchema: {
        host: z
          .string()
          .trim()
          .min(1)
          .describe("The domain name of your site (e.g. 'example.com') without protocol"),
        urls: z
          .string()
          .min(1)
          .describe(
            "Comma-separated or newline-separated list of full URLs to submit (or JSON array of URLs)",
          ),
        key: z
          .string()
          .optional()
          .describe(
            "IndexNow key (sensitive; prefer INDEXNOW_KEY env var to avoid storing keys in chat history)",
          ),
        keyLocation: z
          .string()
          .optional()
          .describe("Optional full URL to the key file if not at site root"),
      },
      annotations: SUBMIT,
    },
    withErrorBoundary("IndexNow submission error", async ({ host, urls, key, keyLocation }) => {
      const res = await submitToIndexNow({ host, urls: parseUrlList(urls), key, keyLocation });
      return okText(renderIndexNowResult(res));
    }),
  );
}
