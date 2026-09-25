import { google, searchconsole_v1, indexing_v3 } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { getErrorCode, getErrorMessage } from "../../core/errors.js";

let cachedClient: searchconsole_v1.Searchconsole | null = null;
let cachedIndexingClient: indexing_v3.Indexing | null = null;

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];
const INDEXING_SCOPES = ["https://www.googleapis.com/auth/indexing"];

function createGoogleAuth(
  credentials: unknown,
  scopes: string[],
): InstanceType<typeof google.auth.GoogleAuth> {
  // googleapis types service-account JSON as JWT input; our JSON.parse result is
  // validated at runtime by GoogleAuth itself, so this single interop cast is intentional.
  return new google.auth.GoogleAuth({
    credentials: credentials as never,
    scopes,
  });
}

// Only a positive result is cached, so a slow or failed probe is retried on the next call.
let detectedCredentials = false;
const ADC_PROBE_TIMEOUT_MS = 2000;

function getAdcFilePath(): string | undefined {
  if (process.env.CLOUDSDK_CONFIG) {
    return `${process.env.CLOUDSDK_CONFIG}/application_default_credentials.json`;
  }
  if (process.env.APPDATA) {
    return `${process.env.APPDATA}/gcloud/application_default_credentials.json`;
  }
  const home: string | undefined = process.env.HOME;
  if (home) {
    return `${home}/.config/gcloud/application_default_credentials.json`;
  }
  return undefined;
}

export function isGoogleConfigured(): boolean {
  if (detectedCredentials) {
    return true;
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return true;
  }
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS.trim())
  ) {
    return true;
  }
  const adcPath: string | undefined = getAdcFilePath();
  if (adcPath && existsSync(adcPath)) {
    return true;
  }
  return false;
}

export async function detectGoogleCredentials(): Promise<boolean> {
  if (isGoogleConfigured()) {
    detectedCredentials = true;
    return true;
  }
  let timer: NodeJS.Timeout | undefined;
  try {
    const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Timeout detecting ADC credentials")),
        ADC_PROBE_TIMEOUT_MS,
      );
    });
    await Promise.race([auth.getClient(), timeout]);
    detectedCredentials = true;
    return true;
  } catch {
    // No usable ADC. Do not cache the failure, so a later call can probe again.
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function getGoogleConfigurationGuide(): string {
  return (
    "Google Search Console is not configured.\n\n" +
    "To configure:\n" +
    "1. In Google Cloud Console, create a Service Account and download a JSON key.\n" +
    "2. Enable the Google Search Console API for your Google Cloud project.\n" +
    "3. Set `GOOGLE_APPLICATION_CREDENTIALS` to the JSON key file path (or `GOOGLE_SERVICE_ACCOUNT_KEY` to the raw JSON string).\n" +
    "4. Add the service account email as a user with 'Restricted' or 'Full' permissions in Google Search Console."
  );
}

function buildCredentials(): unknown {
  const rawKey: string | undefined =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawKey && rawKey.trim().length > 0) {
    let jsonString: string = rawKey.trim();
    if (!jsonString.startsWith("{")) {
      try {
        const decoded: string = Buffer.from(jsonString, "base64").toString("utf-8");
        if (decoded.trim().startsWith("{")) {
          jsonString = decoded.trim();
        }
      } catch {
        // keep original; JSON.parse below reports the problem
      }
    }
    try {
      return JSON.parse(jsonString);
    } catch (err: unknown) {
      throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: ${getErrorMessage(err)}.`, {
        cause: err,
      });
    }
  }
  const credentialsPath: string | undefined = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && credentialsPath.trim().length > 0) {
    const trimmedPath: string = credentialsPath.trim();
    if (!existsSync(trimmedPath)) {
      throw new Error(`Credentials file not found at: "${basename(trimmedPath)}".`);
    }
    try {
      return JSON.parse(readFileSync(trimmedPath, "utf-8"));
    } catch (err: unknown) {
      throw new Error(
        `Failed to load service account credentials from "${basename(trimmedPath)}": ${getErrorMessage(err)}`,
        { cause: err },
      );
    }
  }
  return undefined;
}

export function getGoogleSearchConsoleClient(): searchconsole_v1.Searchconsole {
  if (cachedClient) {
    return cachedClient;
  }
  const credentials: unknown = buildCredentials();
  if (credentials === undefined) {
    try {
      const auth = new google.auth.GoogleAuth({ scopes: SCOPES });
      cachedClient = google.searchconsole({ version: "v1", auth });
      return cachedClient;
    } catch {
      throw new Error(getGoogleConfigurationGuide());
    }
  }
  const auth = createGoogleAuth(credentials, SCOPES);
  cachedClient = google.searchconsole({ version: "v1", auth });
  return cachedClient;
}

export function formatGoogleError(
  error: unknown,
  context: "searchconsole" | "indexing" = "searchconsole",
): string {
  const code: number | undefined = getErrorCode(error);
  const msg: string = getErrorMessage(error);
  if (msg.includes("Could not load the default credentials")) {
    return context === "indexing"
      ? getGoogleIndexingConfigurationGuide()
      : getGoogleConfigurationGuide();
  }
  if (
    code === 403 ||
    msg.includes("User does not have sufficient permission") ||
    msg.includes("PERMISSION_DENIED")
  ) {
    const tip: string =
      context === "indexing"
        ? "The Indexing API requires the service account email to be added as an 'Owner' of this property in Google Search Console."
        : "Make sure the service account email is added as a user with 'Restricted' or 'Full' permission in Google Search Console for this property.";
    return `Permission error (403): ${msg}\n\n${tip}`;
  }
  if (code === 404) {
    return `Not found (404): ${msg}`;
  }
  if (code === 400) {
    return `Bad request (400): ${msg}`;
  }
  if (code === 429) {
    if (context === "indexing") {
      return `Quota exceeded (429): ${msg}\n\nThe Google Indexing API defaults to 200 publish requests per day. Reduce batch size or retry tomorrow.`;
    }
    return `Quota exceeded (429): ${msg}\n\nSearch Console query or inspection quota exceeded. Please reduce request frequency or retry later.`;
  }
  return msg;
}

export function isGoogleIndexingConfigured(): boolean {
  return isGoogleConfigured();
}

export function getGoogleIndexingConfigurationGuide(): string {
  return (
    "Google Indexing API is not configured or not enabled.\n\n" +
    "To configure:\n" +
    "1. Use the same service account as Search Console (`GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_SERVICE_ACCOUNT_KEY`).\n" +
    "2. Enable the Indexing API in Google Cloud Console: APIs & Services → Library → Indexing API → Enable.\n" +
    "3. Verify ownership of each URL's domain in Search Console with the same service-account owner.\n" +
    "4. Note limits: only JobPosting or BroadcastEvent (in VideoObject) pages are eligible, and the default quota is 200 publish requests per day.\n" +
    "5. Request extra quota in Cloud Console if needed."
  );
}

export function getGoogleIndexingClient(): indexing_v3.Indexing {
  if (cachedIndexingClient) {
    return cachedIndexingClient;
  }
  const credentials: unknown = buildCredentials();
  if (credentials === undefined) {
    try {
      const auth = new google.auth.GoogleAuth({ scopes: INDEXING_SCOPES });
      cachedIndexingClient = google.indexing({ version: "v3", auth });
      return cachedIndexingClient;
    } catch {
      throw new Error(getGoogleIndexingConfigurationGuide());
    }
  }
  const auth = createGoogleAuth(credentials, INDEXING_SCOPES);
  cachedIndexingClient = google.indexing({ version: "v3", auth });
  return cachedIndexingClient;
}
