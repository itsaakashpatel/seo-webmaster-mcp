import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { submitToIndexNow } from "../providers/indexnow/provider.js";
import { getErrorMessage } from "../core/errors.js";
import { parseUrlList } from "../core/urls.js";
import { okText, errText } from "../core/responses.js";

export function registerSubmitUrlsTool(server: McpServer): void {
  server.tool(
    "submit_urls_indexnow",
    "Instantly notify Bing, Yandex, Seznam, and other IndexNow search engines about added, updated, or deleted URLs on your website.",
    {
      host: z
        .string()
        .min(1)
        .describe("The domain name of your site (e.g. 'example.com') without protocol"),
      urls: z
        .string()
        .min(1)
        .describe(
          "Comma-separated or newline-separated list of full URLs to submit (or JSON array of URLs)"
        ),
      key: z
        .string()
        .optional()
        .describe(
          "IndexNow key (sensitive; prefer INDEXNOW_KEY env var to avoid storing keys in chat history)"
        ),
      keyLocation: z
        .string()
        .optional()
        .describe("Optional full URL to the key file if not at site root"),
    },
    async ({ host, urls, key, keyLocation }) => {
      try {
        let parsedUrls: string[];
        try {
          parsedUrls = parseUrlList(urls);
        } catch (err: unknown) {
          return errText(`Invalid urls input: ${getErrorMessage(err)}`);
        }

        if (parsedUrls.length === 0) {
          return errText("No valid URLs provided to submit.");
        }

        const res = await submitToIndexNow({
          host: host.trim(),
          urls: parsedUrls,
          key,
          keyLocation,
        });

        const lines: string[] = [];
        lines.push("### IndexNow URL Submission Successful");
        lines.push(`- **Host:** \`${res.host}\``);
        lines.push(`- **URLs Submitted:** ${res.submittedCount}`);
        lines.push(`- **Status:** ${res.statusCode} (${res.statusMessage})`);
        lines.push(`- **Target Engines:** Bing, Yandex, Seznam, Naver`);
        lines.push("\n**Submitted URLs:**");
        for (const u of res.urlList.slice(0, 10)) {
          lines.push(`- \`${u}\``);
        }
        if (res.urlList.length > 10) {
          lines.push(`- *...and ${res.urlList.length - 10} more URLs*`);
        }

        return okText(lines.join("\n"));
      } catch (error: unknown) {
        return errText(`IndexNow submission error: ${getErrorMessage(error)}`);
      }
    }
  );
}
