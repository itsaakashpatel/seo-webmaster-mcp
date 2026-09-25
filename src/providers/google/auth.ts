import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { google, type Auth, type indexing_v3, type searchconsole_v1 } from "googleapis";
import { getErrorCode, getErrorMessage } from "../../core/errors.js";
import { isRecord } from "../../core/guards.js";

const SEARCH_CONSOLE_SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];
const INDEXING_SCOPES = ["https://www.googleapis.com/auth/indexing"];
const ADC_PROBE_TIMEOUT_MS = 2000;

export type GoogleApi = "searchconsole" | "indexing";

export const GOOGLE_SETUP_GUIDE = [
  "Google Search Console is not configured.",
  "",
  "To configure:",
  "1. In Google Cloud Console, create a Service Account and download a JSON key.",
  "2. Enable the Google Search Console API for your Google Cloud project.",
  "3. Set `GOOGLE_APPLICATION_CREDENTIALS` to the JSON key file path (or `GOOGLE_SERVICE_ACCOUNT_KEY` to the raw JSON string).",
  "4. Add the service account email as a user with 'Restricted' or 'Full' permissions in Google Search Console.",
].join("\n");

export const GOOGLE_INDEXING_SETUP_GUIDE = [
  "Google Indexing API is not configured or not enabled.",
  "",
  "To configure:",
  "1. Use the same service account as Search Console (`GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_SERVICE_ACCOUNT_KEY`).",
  "2. Enable the Indexing API in Google Cloud Console: APIs & Services → Library → Indexing API → Enable.",
  "3. Add the service account email as an 'Owner' of each property in Search Console.",
  "4. Note limits: only JobPosting or BroadcastEvent (in VideoObject) pages are eligible, and the default quota is 200 publish requests per day.",
  "5. Request extra quota in Cloud Console if needed.",
].join("\n");

interface ApiErrorTips {
  readonly guide: string;
  readonly forbidden: string;
  readonly quota: string;
}

const ERROR_TIPS: Readonly<Record<GoogleApi, ApiErrorTips>> = {
  searchconsole: {
    guide: GOOGLE_SETUP_GUIDE,
    forbidden:
      "Make sure the service account email is added as a user with 'Restricted' or 'Full' permission in Google Search Console for this property.",
    quota:
      "Search Console query or inspection quota exceeded. Please reduce request frequency or retry later.",
  },
  indexing: {
    guide: GOOGLE_INDEXING_SETUP_GUIDE,
    forbidden:
      "The Indexing API requires the service account email to be added as an 'Owner' of this property in Google Search Console.",
    quota:
      "The Google Indexing API defaults to 200 publish requests per day. Reduce batch size or retry tomorrow.",
  },
};

const STATUS_LABELS: Readonly<Partial<Record<number, string>>> = {
  400: "Bad request",
  404: "Not found",
  429: "Quota exceeded",
};

const PERMISSION_MARKERS = ["User does not have sufficient permission", "PERMISSION_DENIED"];

// Only a positive result is cached, so a slow or failed probe is retried on the next call.
let adcDetected = false;

function getAdcFilePath(): string | undefined {
  const { CLOUDSDK_CONFIG, APPDATA, HOME } = process.env;
  const configDir =
    // `||`, not `??`: MCP clients often pass an empty string for an unset variable.
    CLOUDSDK_CONFIG ||
    (APPDATA ? join(APPDATA, "gcloud") : undefined) ||
    (HOME ? join(HOME, ".config", "gcloud") : undefined);
  return configDir ? join(configDir, "application_default_credentials.json") : undefined;
}

function getRawServiceAccountKey(): string | undefined {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  return raw?.trim() || undefined;
}

function getCredentialsPath(): string | undefined {
  return process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || undefined;
}

export function isGoogleConfigured(): boolean {
  const credentialsPath = getCredentialsPath();
  const adcPath = getAdcFilePath();
  return (
    adcDetected ||
    getRawServiceAccountKey() !== undefined ||
    (credentialsPath !== undefined && existsSync(credentialsPath)) ||
    (adcPath !== undefined && existsSync(adcPath))
  );
}

/** Probes Application Default Credentials (for example GCE metadata) with a short timeout. */
export async function detectGoogleCredentials(): Promise<boolean> {
  if (isGoogleConfigured()) {
    return true;
  }
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("ADC probe timed out")), ADC_PROBE_TIMEOUT_MS);
  });
  try {
    await Promise.race([new google.auth.GoogleAuth().getClient(), timeout]);
    adcDetected = true;
  } catch {
    // No usable ADC. The failure is not cached, so a later call can probe again.
  } finally {
    clearTimeout(timer);
  }
  return adcDetected;
}

/** Accepts raw JSON or base64-encoded JSON. */
function decodeServiceAccountKey(raw: string): string {
  if (raw.startsWith("{")) {
    return raw;
  }
  const decoded = Buffer.from(raw, "base64").toString("utf-8").trim();
  return decoded.startsWith("{") ? decoded : raw;
}

function parseCredentials(json: string, source: string): Auth.JWTInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err: unknown) {
    throw new Error(`Failed to parse ${source}: ${getErrorMessage(err)}.`, { cause: err });
  }
  if (!isRecord(parsed)) {
    throw new Error(`Failed to parse ${source}: expected a JSON object.`);
  }
  // Interop cast: GoogleAuth validates the service-account fields itself when it signs a token.
  return parsed as Auth.JWTInput;
}

function readCredentialsFile(path: string): string {
  const name = basename(path);
  if (!existsSync(path)) {
    throw new Error(`Credentials file not found at: "${name}".`);
  }
  try {
    return readFileSync(path, "utf-8");
  } catch (err: unknown) {
    // The raw fs error contains the full path. Report only the base name and the error code.
    const code = isRecord(err) && typeof err.code === "string" ? err.code : "read error";
    throw new Error(`Failed to read credentials file "${name}" (${code}).`, { cause: err });
  }
}

/** Loads explicit service-account credentials. Returns `undefined` to fall back to ADC. */
function loadCredentials(): Auth.JWTInput | undefined {
  const rawKey = getRawServiceAccountKey();
  if (rawKey) {
    return parseCredentials(decodeServiceAccountKey(rawKey), "GOOGLE_SERVICE_ACCOUNT_KEY");
  }
  const path = getCredentialsPath();
  return path ? parseCredentials(readCredentialsFile(path), `"${basename(path)}"`) : undefined;
}

function createAuth(scopes: string[]): Auth.GoogleAuth {
  return new google.auth.GoogleAuth({ credentials: loadCredentials(), scopes });
}

function lazy<T>(factory: () => T): () => T {
  let value: T | undefined;
  return () => {
    value ??= factory();
    return value;
  };
}

export const getSearchConsoleClient: () => searchconsole_v1.Searchconsole = lazy(() =>
  google.searchconsole({ version: "v1", auth: createAuth(SEARCH_CONSOLE_SCOPES) }),
);

export const getIndexingClient: () => indexing_v3.Indexing = lazy(() =>
  google.indexing({ version: "v3", auth: createAuth(INDEXING_SCOPES) }),
);

/** Turns a Google API error into a message with the status and a fix for the given API. */
export function formatGoogleError(error: unknown, api: GoogleApi = "searchconsole"): string {
  const code = getErrorCode(error);
  const msg = getErrorMessage(error);
  const tips = ERROR_TIPS[api];
  if (msg.includes("Could not load the default credentials")) {
    return tips.guide;
  }
  if (code === 403 || PERMISSION_MARKERS.some((marker) => msg.includes(marker))) {
    return `Permission error (403): ${msg}\n\n${tips.forbidden}`;
  }
  const label = code === undefined ? undefined : STATUS_LABELS[code];
  if (!label) {
    return msg;
  }
  const tip = code === 429 ? `\n\n${tips.quota}` : "";
  return `${label} (${code}): ${msg}${tip}`;
}

/** Runs a Google API call and rethrows any failure with a formatted message. */
export async function withGoogleErrors<T>(
  action: () => Promise<T>,
  api: GoogleApi = "searchconsole",
): Promise<T> {
  try {
    return await action();
  } catch (err: unknown) {
    throw new Error(formatGoogleError(err, api), { cause: err });
  }
}
