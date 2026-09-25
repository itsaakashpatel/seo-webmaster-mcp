import { MAX_INDEXNOW_URLS, USER_AGENT } from "../../core/constants.js";
import { HttpError } from "../../core/errors.js";
import { fetchWithTimeout, readBodyText } from "../../core/http.js";
import type { IndexNowSubmissionResult } from "../../core/types.js";
import { dedupeUrls, parseHttpUrl, urlsBelongToHost } from "../../core/urls.js";
import { normalizeHost } from "../../core/validation.js";

const INDEXNOW_ENDPOINT = new URL("https://api.indexnow.org/indexnow");

export const INDEXNOW_SETUP_GUIDE = [
  "IndexNow is not configured.",
  "",
  "To configure:",
  "1. Generate an IndexNow key (a 32-character hex or alphanumeric string, e.g. at https://www.bing.com/indexnow).",
  "2. Host a text file with your key name at your site root: `https://example.com/<your-key>.txt` containing only the key.",
  "3. Set the `INDEXNOW_KEY` environment variable in your MCP client configuration.",
  "4. (Optional) Set `INDEXNOW_KEY_LOCATION` if your key file is located at a custom subpath.",
].join("\n");

const STATUS_MESSAGES: Readonly<Partial<Record<number, string>>> = {
  200: "URLs successfully submitted and processed by IndexNow.",
  202: "URLs received by IndexNow. Key validation will be performed asynchronously.",
  400: "Invalid format: Check host, key, and URL formats.",
  403: "Forbidden: The key is not valid or not hosted at the expected location.",
  422: "Unprocessable entity: URLs do not belong to the specified host or key mismatch.",
  429: "Rate limited: Too many requests to IndexNow.",
};

export interface IndexNowOptions {
  readonly host: string;
  readonly urls: readonly string[];
  readonly key?: string;
  readonly keyLocation?: string;
}

interface IndexNowPayload {
  readonly host: string;
  readonly key: string;
  readonly urlList: readonly string[];
  readonly keyLocation?: string;
}

function readKey(key: string | undefined): string | undefined {
  return (key || process.env.INDEXNOW_KEY)?.trim() || undefined;
}

export function isIndexNowConfigured(): boolean {
  return readKey(undefined) !== undefined;
}

function validateUrls(urls: readonly string[], host: string): string[] {
  const unique = dedupeUrls(urls);
  if (unique.length === 0) {
    throw new Error("No valid URLs provided to submit.");
  }
  if (unique.length > MAX_INDEXNOW_URLS) {
    throw new Error(
      `Too many URLs (${unique.length}). IndexNow allows max ${MAX_INDEXNOW_URLS} per request.`,
    );
  }
  const foreign = urlsBelongToHost(unique, host);
  if (foreign.length > 0) {
    throw new Error(
      `${foreign.length} URL(s) do not belong to host "${host}" or use non-http(s) scheme (e.g. ${foreign.slice(0, 3).join(", ")}). All URLs must be https://<host>/...`,
    );
  }
  return unique;
}

function validateKeyLocation(raw: string | undefined): string | undefined {
  const keyLocation = (raw || process.env.INDEXNOW_KEY_LOCATION)?.trim();
  if (keyLocation && !parseHttpUrl(keyLocation)) {
    throw new Error(`Invalid keyLocation "${keyLocation}": must be a full http(s) URL.`);
  }
  return keyLocation || undefined;
}

function buildPayload(options: IndexNowOptions): IndexNowPayload {
  const key = readKey(options.key);
  if (!key) {
    throw new Error(INDEXNOW_SETUP_GUIDE);
  }
  const host = normalizeHost(options.host);
  return {
    host,
    key,
    urlList: validateUrls(options.urls, host),
    keyLocation: validateKeyLocation(options.keyLocation),
  };
}

function describeStatus(status: number, body: string): string {
  const message = STATUS_MESSAGES[status];
  if (!message) {
    return `IndexNow response code ${status}: ${body}`;
  }
  return status >= 400 && body ? `${message} Detail: ${body}` : message;
}

/** Submits URLs to the shared IndexNow endpoint. Throws `HttpError` on a 4xx or 5xx response. */
export async function submitToIndexNow(
  options: IndexNowOptions,
): Promise<IndexNowSubmissionResult> {
  const payload = buildPayload(options);
  const res = await fetchWithTimeout(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", "User-Agent": USER_AGENT },
    body: JSON.stringify(payload),
  });
  const statusMessage = describeStatus(res.status, (await readBodyText(res)) || res.statusText);
  if (!res.ok) {
    throw new HttpError(statusMessage, res.status);
  }
  return {
    engine: "indexnow",
    host: payload.host,
    submittedCount: payload.urlList.length,
    statusCode: res.status,
    statusMessage,
    urlList: payload.urlList,
  };
}
