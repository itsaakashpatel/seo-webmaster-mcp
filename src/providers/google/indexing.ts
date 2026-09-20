import {
  GoogleIndexingSubmissionResult,
  GoogleIndexingItemResult,
  GoogleIndexingType,
} from "../../core/types.js";
import {
  getGoogleIndexingClient,
  isGoogleIndexingConfigured,
  getGoogleIndexingConfigurationGuide,
  formatGoogleError,
} from "./auth.js";
import { getErrorCode, getErrorMessage } from "../../core/errors.js";
import { MAX_GOOGLE_INDEXING_URLS } from "../../core/validation.js";
import { dedupeUrls, validateHttpsUrls } from "../../core/urls.js";

export const GOOGLE_INDEXING_QUOTA_PER_DAY = MAX_GOOGLE_INDEXING_URLS;

export function isIndexingConfigured(): boolean {
  return isGoogleIndexingConfigured();
}

export function getIndexingGuide(): string {
  return getGoogleIndexingConfigurationGuide();
}

function toItemError(
  url: string,
  type: GoogleIndexingType,
  err: unknown,
): GoogleIndexingItemResult {
  const code: number | undefined = getErrorCode(err);
  return {
    url,
    type,
    success: false,
    statusCode: code ?? 0,
    message: formatGoogleError(err),
  };
}

export async function submitToGoogleIndexing(options: {
  urls: string[];
  type?: GoogleIndexingType;
}): Promise<GoogleIndexingSubmissionResult> {
  const notificationType: GoogleIndexingType = options.type ?? "URL_UPDATED";
  if (notificationType !== "URL_UPDATED" && notificationType !== "URL_DELETED") {
    throw new Error(`Invalid type "${options.type}". Use "URL_UPDATED" or "URL_DELETED".`);
  }
  const deduped: string[] = dedupeUrls(options.urls);
  if (deduped.length === 0) {
    throw new Error("No valid URLs provided to submit.");
  }
  if (deduped.length > MAX_GOOGLE_INDEXING_URLS) {
    throw new Error(
      `Too many URLs (${deduped.length}). Google Indexing API allows max ${MAX_GOOGLE_INDEXING_URLS} per call (default daily quota is 200). Split into smaller batches.`,
    );
  }
  const bad: string[] = validateHttpsUrls(deduped);
  if (bad.length > 0) {
    const sample: string = bad.slice(0, 3).join(", ");
    throw new Error(
      `${bad.length} URL(s) are not valid http(s) URLs (e.g. ${sample}). All URLs must be fully qualified.`,
    );
  }
  if (!isGoogleIndexingConfigured()) {
    throw new Error(getGoogleIndexingConfigurationGuide());
  }

  const client = getGoogleIndexingClient();
  const items: GoogleIndexingItemResult[] = [];

  for (const url of deduped) {
    try {
      const res = await client.urlNotifications.publish({
        requestBody: { url, type: notificationType },
      });
      const meta = res.data.urlNotificationMetadata;
      const notifyTime: string | undefined =
        meta?.latestUpdate?.notifyTime ?? meta?.latestRemove?.notifyTime ?? undefined;
      items.push({
        url,
        type: notificationType,
        success: true,
        statusCode: 200,
        message:
          "Notification accepted. Google may recrawl (update) or drop (delete) the URL soon.",
        notifyTime,
      });
    } catch (err: unknown) {
      items.push(toItemError(url, notificationType, err));
      const code: number | undefined = getErrorCode(err);
      if (code === 429) {
        const remaining: string[] = deduped.slice(items.length);
        for (const rest of remaining) {
          items.push({
            url: rest,
            type: notificationType,
            success: false,
            statusCode: 429,
            message:
              "Skipped: quota exhausted earlier in this batch (429). Retry remaining URLs tomorrow.",
          });
        }
        break;
      }
    }
  }

  const successCount: number = items.filter((i: GoogleIndexingItemResult) => i.success).length;
  return {
    engine: "google",
    submittedCount: deduped.length,
    successCount,
    failureCount: items.length - successCount,
    notificationType,
    items,
  };
}

export async function getGoogleNotificationStatus(url: string): Promise<string> {
  const clean: string = url.trim();
  if (clean.length === 0) {
    throw new Error("url must be non-empty.");
  }
  try {
    const client = getGoogleIndexingClient();
    const res = await client.urlNotifications.getMetadata({ url: clean });
    return JSON.stringify(res.data, null, 2);
  } catch (err: unknown) {
    throw new Error(`Failed to get notification status for "${clean}": ${getErrorMessage(err)}`, {
      cause: err,
    });
  }
}
