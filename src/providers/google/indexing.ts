import type { indexing_v3 } from "googleapis";
import { MAX_GOOGLE_INDEXING_URLS } from "../../core/constants.js";
import { getErrorCode } from "../../core/errors.js";
import type {
  GoogleIndexingItemResult,
  GoogleIndexingSubmissionResult,
  GoogleIndexingType,
} from "../../core/types.js";
import { dedupeUrls, validateHttpsUrls } from "../../core/urls.js";
import {
  GOOGLE_INDEXING_SETUP_GUIDE,
  detectGoogleCredentials,
  formatGoogleError,
  getIndexingClient,
} from "./auth.js";

const BATCH_CONCURRENCY = 5;
const QUOTA_EXCEEDED = 429;

export interface GoogleIndexingOptions {
  readonly urls: readonly string[];
  readonly type?: GoogleIndexingType;
}

function validateUrls(urls: readonly string[]): string[] {
  const unique = dedupeUrls(urls);
  if (unique.length === 0) {
    throw new Error("No valid URLs provided to submit.");
  }
  if (unique.length > MAX_GOOGLE_INDEXING_URLS) {
    throw new Error(
      `Too many URLs (${unique.length}). Google Indexing API allows max ${MAX_GOOGLE_INDEXING_URLS} per call (default daily quota is 200). Split into smaller batches.`,
    );
  }
  const invalid = validateHttpsUrls(unique);
  if (invalid.length > 0) {
    throw new Error(
      `${invalid.length} URL(s) are not valid http(s) URLs (e.g. ${invalid.slice(0, 3).join(", ")}). All URLs must be fully qualified.`,
    );
  }
  return unique;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

async function publish(
  client: indexing_v3.Indexing,
  url: string,
  type: GoogleIndexingType,
): Promise<GoogleIndexingItemResult> {
  try {
    const res = await client.urlNotifications.publish({ requestBody: { url, type } });
    const meta = res.data.urlNotificationMetadata;
    return {
      url,
      type,
      success: true,
      statusCode: 200,
      message: "Notification accepted. Google may recrawl (update) or drop (delete) the URL soon.",
      notifyTime: meta?.latestUpdate?.notifyTime ?? meta?.latestRemove?.notifyTime ?? undefined,
    };
  } catch (err: unknown) {
    return {
      url,
      type,
      success: false,
      statusCode: getErrorCode(err) ?? 0,
      message: formatGoogleError(err, "indexing"),
    };
  }
}

function skipped(url: string, type: GoogleIndexingType): GoogleIndexingItemResult {
  return {
    url,
    type,
    success: false,
    statusCode: QUOTA_EXCEEDED,
    message: "Skipped: quota exhausted earlier in this batch (429). Retry remaining URLs tomorrow.",
  };
}

/**
 * Publishes URL notifications in batches of 5 parallel requests. After the first 429 (quota
 * exhausted) response, the remaining URLs are reported as skipped and are not sent.
 */
export async function submitToGoogleIndexing({
  urls,
  type = "URL_UPDATED",
}: GoogleIndexingOptions): Promise<GoogleIndexingSubmissionResult> {
  const unique = validateUrls(urls);
  if (!(await detectGoogleCredentials())) {
    throw new Error(GOOGLE_INDEXING_SETUP_GUIDE);
  }
  const client = getIndexingClient();
  const items: GoogleIndexingItemResult[] = [];
  for (const batch of chunk(unique, BATCH_CONCURRENCY)) {
    const quotaExhausted = items.some((item) => item.statusCode === QUOTA_EXCEEDED);
    const results = quotaExhausted
      ? batch.map((url) => skipped(url, type))
      : // oxlint-disable-next-line no-await-in-loop -- batches run in sequence to cap concurrency.
        await Promise.all(batch.map((url) => publish(client, url, type)));
    items.push(...results);
  }
  const successCount = items.filter((item) => item.success).length;
  return {
    engine: "google",
    submittedCount: unique.length,
    successCount,
    failureCount: items.length - successCount,
    notificationType: type,
    items,
  };
}
