import { USER_AGENT } from "../../core/constants.js";
import { getErrorCode, getErrorMessage } from "../../core/errors.js";
import { isRecord } from "../../core/guards.js";
import { ensureOk, fetchWithTimeout, readJsonSafe } from "../../core/http.js";

const BING_API_BASE = "https://ssl.bing.com/webmaster/api.json";

export const BING_SETUP_GUIDE = [
  "Bing Webmaster Tools is not configured.",
  "",
  "To configure:",
  "1. Sign in to Bing Webmaster Tools (https://www.bing.com/webmasters).",
  "2. Navigate to Settings (top right gear icon) → API Access → API Key.",
  "3. Generate an API Key and copy it.",
  "4. Set the `BING_WEBMASTER_API_KEY` environment variable in your MCP client configuration.",
  "5. Ensure your site is added and verified in Bing Webmaster Tools.",
].join("\n");

export type BingEndpoint =
  | "GetUserSites"
  | "GetQueryStats"
  | "GetPageStats"
  | "GetCrawlStats"
  | "GetFeeds";

function readApiKey(): string | undefined {
  return process.env.BING_WEBMASTER_API_KEY?.trim() || undefined;
}

export function isBingConfigured(): boolean {
  return readApiKey() !== undefined;
}

export function formatBingError(error: unknown): string {
  const code = getErrorCode(error);
  const msg = getErrorMessage(error);
  if (code === 401 || msg.includes("Unauthorized") || msg.includes("Invalid API Key")) {
    return `Bing Webmaster API authentication failed (401 Invalid API Key): ${msg}\n\nPlease verify your \`BING_WEBMASTER_API_KEY\` in Bing Webmaster Tools Settings → API Access.`;
  }
  if (code === 403 || msg.includes("Forbidden")) {
    return `Bing Webmaster permission denied (403): ${msg}\n\nEnsure your Bing account has verified ownership of the requested site property.`;
  }
  return msg;
}

/** Calls a Bing Webmaster JSON endpoint and unwraps the `{ d: ... }` envelope. */
export async function bingGet(
  endpoint: BingEndpoint,
  params: Readonly<Record<string, string>> = {},
): Promise<unknown> {
  const apiKey = readApiKey();
  if (!apiKey) {
    throw new Error(BING_SETUP_GUIDE);
  }
  const url = new URL(`${BING_API_BASE}/${endpoint}`);
  url.search = new URLSearchParams({ ...params, apikey: apiKey }).toString();
  const res = await fetchWithTimeout(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });
  const json = await readJsonSafe(await ensureOk(res, "Bing Webmaster API"));
  return isRecord(json) && "d" in json ? json.d : json;
}

/** Runs a Bing call and rethrows any failure with a formatted message. */
export async function withBingErrors<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err: unknown) {
    throw new Error(formatBingError(err), { cause: err });
  }
}
