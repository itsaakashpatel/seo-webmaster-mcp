import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { submitToIndexNow } from "../providers/indexnow/provider.js";

export function registerSubmitUrlsTool(server: McpServer) {
  server.tool(
    "submit_urls_indexnow",
    "Instantly notify Bing, Yandex, Seznam, and other IndexNow search engines about added, updated, or deleted URLs on your website.",
    {
      host: z
        .string()
        .describe("The domain name of your site (e.g. 'example.com') without protocol"),
      urls: z
        .string()
        .describe(
          "Comma-separated or newline-separated list of full URLs to submit (or JSON array of URLs)"
        ),
      key: z
        .string()
        .optional()
        .describe("IndexNow key (optional if INDEXNOW_KEY environment variable is set)"),
      keyLocation: z
        .string()
        .optional()
        .describe("Optional full URL to the key file if not at site root"),
    },
    async ({ host, urls, key, keyLocation }) => {
      try {
        let parsedUrls: string[] = [];

        const trimmed = urls.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            parsedUrls = JSON.parse(trimmed);
          } catch {
            parsedUrls = trimmed.split(/[\r\n,]+/).map((u) => u.trim());
          }
        } else {
          parsedUrls = trimmed.split(/[\r\n,]+/).map((u) => u.trim());
        }

        parsedUrls = parsedUrls.filter((u) => u.length > 0);

        if (parsedUrls.length === 0) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "No valid URLs provided to submit.",
              },
            ],
          };
        }

        const cleanHost = host.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

        const res = await submitToIndexNow({
          host: cleanHost,
          urls: parsedUrls,
          key,
          keyLocation,
        });

        const lines: string[] = [];
        lines.push("### IndexNow URL Submission Successful 🚀");
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
              text: `IndexNow submission error: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}
