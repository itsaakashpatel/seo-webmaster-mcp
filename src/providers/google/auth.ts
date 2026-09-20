import { google, searchconsole_v1, indexing_v3 } from "googleapis";
import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { getErrorCode, getErrorMessage } from "../../core/errors.js";

let cachedClient: searchconsole_v1.Searchconsole | null = null;
let cachedIndexingClient: indexing_v3.Indexing | null = null;

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];
const INDEXING_SCOPES = ["https://www.googleapis.com/auth/indexing"];

function createGoogleAuth(credentials: unknown, scopes: string[]): InstanceType<typeof google.auth.GoogleAuth> {
  // googleapis types service-account JSON as JWT input; our JSON.parse result is
  // validated at runtime by GoogleAuth itself, so this single interop cast is intentional.
  return new google.auth.GoogleAuth({
    credentials: credentials as never,
    scopes,
  });
}

export function isGoogleConfigured(): boolean {
  if (
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ) {
    return true;
  }
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS.trim())
  ) {
    return true;
  }
  return false;
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
      throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: ${getErrorMessage(err)}.`);
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
        `Failed to load service account credentials from "${basename(trimmedPath)}": ${getErrorMessage(err)}`
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

export function formatGoogleError(error: unknown): string {
  const code: number | undefined = getErrorCode(error);
  const msg: string = getErrorMessage(error);
  if (msg.includes("Could not load the default credentials")) {
    return getGoogleConfigurationGuide();
  }
  if (
    code === 403 ||
    msg.includes("User does not have sufficient permission") ||
    msg.includes("PERMISSION_DENIED")
  ) {
    return (
      `Permission error (403): ${msg}\n\n` +
      "Make sure the service account email is added as a user with 'Restricted' or 'Full' permission in Google Search Console for this property."
    );
  }
  if (code === 404) {
    return `Not found (404): ${msg}`;
  }
  if (code === 400) {
    return `Bad request (400): ${msg}`;
  }
  if (code === 429) {
    return `Quota exceeded (429): ${msg}\n\nThe Google Indexing API defaults to 200 publish requests per day. Reduce batch size or retry tomorrow.`;
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
  const auth = createGoogleAuth(credentials, INDEXING_SCOPES);
  cachedIndexingClient = google.indexing({ version: "v3", auth });
  return cachedIndexingClient;
}
