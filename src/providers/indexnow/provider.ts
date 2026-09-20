import { IndexNowSubmissionResult } from "../../core/types.js";
import { fetchWithTimeout, readBodyText } from "../../core/http.js";
import { getErrorMessage } from "../../core/errors.js";
import { normalizeHost, MAX_INDEXNOW_URLS } from "../../core/validation.js";
import { dedupeUrls, urlsBelongToHost } from "../../core/urls.js";

export function isIndexNowConfigured(): boolean {
  return Boolean(process.env.INDEXNOW_KEY && process.env.INDEXNOW_KEY.trim().length > 0);
}

export function getIndexNowConfigurationGuide(): string {
  return (
    "IndexNow is not configured.\n\n" +
    "To configure:\n" +
    "1. Generate an IndexNow key (a 32-character hex or alphanumeric string, e.g. at https://www.bing.com/indexnow).\n" +
    "2. Host a text file with your key name at your site root: `https://example.com/<your-key>.txt` containing only the key.\n" +
    "3. Set the `INDEXNOW_KEY` environment variable in your MCP client configuration.\n" +
    "4. (Optional) Set `INDEXNOW_KEY_LOCATION` if your key file is located at a custom subpath."
  );
}

export async function submitToIndexNow(options: {
  host: string;
  urls: string[];
  key?: string;
  keyLocation?: string;
}): Promise<IndexNowSubmissionResult> {
  const activeKey: string | undefined = (options.key || process.env.INDEXNOW_KEY)?.trim();

  if (!activeKey) {
    throw new Error(getIndexNowConfigurationGuide());
  }

  const host: string = normalizeHost(options.host);
  const deduped: string[] = dedupeUrls(options.urls);

  if (deduped.length === 0) {
    throw new Error("No valid URLs provided to submit.");
  }
  if (deduped.length > MAX_INDEXNOW_URLS) {
    throw new Error(
      `Too many URLs (${deduped.length}). IndexNow allows max ${MAX_INDEXNOW_URLS} per request.`,
    );
  }
  const bad: string[] = urlsBelongToHost(deduped, host);
  if (bad.length > 0) {
    const sample: string = bad.slice(0, 3).join(", ");
    throw new Error(
      `${bad.length} URL(s) do not belong to host "${host}" or use non-http(s) scheme (e.g. ${sample}). All URLs must be https://<host>/...`,
    );
  }

  const keyLocation: string | undefined = (
    options.keyLocation || process.env.INDEXNOW_KEY_LOCATION
  )?.trim();
  if (keyLocation) {
    try {
      const loc = new URL(keyLocation);
      if (loc.protocol !== "http:" && loc.protocol !== "https:") {
        throw new Error("keyLocation must be http(s).");
      }
    } catch (err: unknown) {
      const msg: string = getErrorMessage(err);
      if (msg.includes("keyLocation must be")) {
        throw err;
      }
      throw new Error(`Invalid keyLocation "${keyLocation}": must be a full http(s) URL.`, {
        cause: err,
      });
    }
  }

  const payload: Record<string, unknown> = {
    host,
    key: activeKey,
    urlList: deduped,
  };

  if (keyLocation) {
    payload["keyLocation"] = keyLocation;
  }

  const endpoint = "https://api.indexnow.org/indexnow";

  let res: Response;
  try {
    res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "seo-webmaster-mcp/1.0.0",
      },
      body: JSON.stringify(payload),
    });
  } catch (err: unknown) {
    throw new Error(`IndexNow request failed: ${getErrorMessage(err)}`, { cause: err });
  }

  const statusCode: number = res.status;
  const bodyText: string = await readBodyText(res);
  let statusMessage = "";

  switch (statusCode) {
    case 200:
      statusMessage = "URLs successfully submitted and processed by IndexNow.";
      break;
    case 202:
      statusMessage = "URLs received by IndexNow. Key validation will be performed asynchronously.";
      break;
    case 400:
      statusMessage = `Invalid format: Check host, key, and URL formats. Detail: ${bodyText}`;
      break;
    case 403:
      statusMessage = `Forbidden: The key is not valid or not hosted at the expected location. Detail: ${bodyText}`;
      break;
    case 422:
      statusMessage = `Unprocessable entity: URLs do not belong to the specified host or key mismatch. Detail: ${bodyText}`;
      break;
    case 429:
      statusMessage = `Rate limited: Too many requests to IndexNow. Detail: ${bodyText}`;
      break;
    default:
      statusMessage = `IndexNow response code ${statusCode}: ${bodyText || res.statusText}`;
  }

  if (statusCode >= 400) {
    throw new Error(statusMessage);
  }

  return {
    engine: "indexnow",
    host,
    submittedCount: deduped.length,
    statusCode,
    statusMessage,
    urlList: deduped,
  };
}
