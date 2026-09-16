import { google, searchconsole_v1 } from "googleapis";
import { readFileSync, existsSync } from "node:fs";

let cachedClient: searchconsole_v1.Searchconsole | null = null;

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

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

export function getGoogleSearchConsoleClient(): searchconsole_v1.Searchconsole {
  if (cachedClient) {
    return cachedClient;
  }

  const rawKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (rawKey && rawKey.trim().length > 0) {
    try {
      let jsonString = rawKey.trim();
      if (!jsonString.startsWith("{")) {
        try {
          const decoded = Buffer.from(jsonString, "base64").toString("utf-8");
          if (decoded.trim().startsWith("{")) {
            jsonString = decoded.trim();
          }
        } catch {
          // ignore
        }
      }

      const credentials = JSON.parse(jsonString);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: SCOPES,
      });

      cachedClient = google.searchconsole({ version: "v1", auth });
      return cachedClient;
    } catch (err: any) {
      throw new Error(
        `Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: ${err.message}. Ensure it contains valid service account JSON.`
      );
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath && credentialsPath.trim().length > 0) {
    const trimmedPath = credentialsPath.trim();
    if (!existsSync(trimmedPath)) {
      throw new Error(
        `Credentials file not found at: "${trimmedPath}". Verify that the file exists.`
      );
    }

    try {
      const fileContent = readFileSync(trimmedPath, "utf-8");
      const credentials = JSON.parse(fileContent);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: SCOPES,
      });

      cachedClient = google.searchconsole({ version: "v1", auth });
      return cachedClient;
    } catch (err: any) {
      throw new Error(
        `Failed to load service account credentials from "${trimmedPath}": ${err.message}`
      );
    }
  }

  // Application Default Credentials fallback
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: SCOPES,
    });
    cachedClient = google.searchconsole({ version: "v1", auth });
    return cachedClient;
  } catch {
    throw new Error(getGoogleConfigurationGuide());
  }
}

export function formatGoogleError(error: any): string {
  const msg = error?.message || String(error);
  if (msg.includes("Could not load the default credentials")) {
    return getGoogleConfigurationGuide();
  }
  if (msg.includes("User does not have sufficient permissions") || msg.includes("403")) {
    return (
      `Permission error: ${msg}\n\n` +
      "Make sure the service account email is added as a user with 'Restricted' or 'Full' permission in Google Search Console for this property."
    );
  }
  return msg;
}
