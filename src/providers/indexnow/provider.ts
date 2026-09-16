import { IndexNowSubmissionResult } from "../../core/types.js";

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
  const activeKey = (options.key || process.env.INDEXNOW_KEY)?.trim();

  if (!activeKey) {
    throw new Error(getIndexNowConfigurationGuide());
  }

  const payload: Record<string, any> = {
    host: options.host,
    key: activeKey,
    urlList: options.urls,
  };

  const keyLocation = (options.keyLocation || process.env.INDEXNOW_KEY_LOCATION)?.trim();
  if (keyLocation) {
    payload.keyLocation = keyLocation;
  }

  const endpoint = "https://api.indexnow.org/indexnow";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": "seo-webmaster-mcp/1.0.0",
    },
    body: JSON.stringify(payload),
  });

  const statusCode = res.status;
  let statusMessage = "";

  switch (statusCode) {
    case 200:
      statusMessage = "URLs successfully submitted and processed by IndexNow.";
      break;
    case 202:
      statusMessage =
        "URLs received by IndexNow. Key validation will be performed asynchronously.";
      break;
    case 400:
      statusMessage = "Invalid format: Check host, key, and URL formats.";
      break;
    case 403:
      statusMessage =
        "Forbidden: The key is not valid or not hosted at the expected location.";
      break;
    case 422:
      statusMessage =
        "Unprocessable entity: URLs do not belong to the specified host or key mismatch.";
      break;
    case 429:
      statusMessage = "Rate limited: Too many requests to IndexNow.";
      break;
    default:
      const text = await res.text().catch(() => "");
      statusMessage = `IndexNow response code ${statusCode}: ${text || res.statusText}`;
  }

  if (statusCode >= 400) {
    throw new Error(statusMessage);
  }

  return {
    engine: "indexnow",
    host: options.host,
    submittedCount: options.urls.length,
    statusCode,
    statusMessage,
    urlList: options.urls,
  };
}
