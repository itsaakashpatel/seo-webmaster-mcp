import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { getErrorMessage } from "../core/errors.js";
import { errText, type ToolResult } from "../core/responses.js";
import { QUERY_ENGINES } from "../core/types.js";

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
