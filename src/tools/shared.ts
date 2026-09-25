import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getErrorMessage } from "../core/errors.js";
import { formatCount } from "../core/markdown.js";
import { errText, type ToolResult } from "../core/responses.js";
import { QUERY_ENGINES, type SitemapInfo } from "../core/types.js";

export const engineSchema = z
  .enum(QUERY_ENGINES)
  .optional()
  .default("google")
  .describe("Search engine provider: 'google' or 'bing' (default: 'google')");

export const siteUrlSchema = z
  .string()
  .trim()
  .min(1)
  .describe(
    "Site URL exactly as verified (e.g. https://example.com/ or sc-domain:example.com for Google)",
  );

/** A tool that only reads data from the search engine. */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: true,
};

/** A tool that sends a notification. Repeating the call has no extra effect. */
export const SUBMIT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

/** Like `SUBMIT`, but each call uses daily quota, so clients must not retry it freely. */
export const SUBMIT_WITH_QUOTA: ToolAnnotations = { ...SUBMIT, idempotentHint: false };

/**
 * Wraps a tool handler so that any thrown error becomes an MCP `isError` result that starts with
 * `errorPrefix`. Handlers can then throw freely and never need their own `try`/`catch`.
 */
export function withErrorBoundary<Args>(
  errorPrefix: string,
  handler: (args: Args) => Promise<ToolResult>,
): (args: Args) => Promise<ToolResult> {
  return async (args) => {
    try {
      return await handler(args);
    } catch (err: unknown) {
      return errText(`${errorPrefix}: ${getErrorMessage(err)}`);
    }
  };
}

/** Renders the indexed / submitted breakdown. Bing has only a submitted count. */
export function renderSitemapCounts(sitemap: SitemapInfo): string[] {
  if (sitemap.contents?.length) {
    return sitemap.contents.map(
      (content) =>
        `- **${content.type}**: ${formatCount(content.indexed)} indexed / ${formatCount(content.submitted)} submitted`,
    );
  }
  return sitemap.submittedUrls === undefined
    ? []
    : [`- **Submitted URLs**: ${formatCount(sitemap.submittedUrls)}`];
}
