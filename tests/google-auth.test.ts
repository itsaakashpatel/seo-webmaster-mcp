import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSearchConsoleClient, isGoogleConfigured } from "../build/providers/google/auth.js";

const GOOGLE_ENV = [
  "GOOGLE_SERVICE_ACCOUNT_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "CLOUDSDK_CONFIG",
  "APPDATA",
  "HOME",
] as const;

function withEnv(
  values: Partial<Record<(typeof GOOGLE_ENV)[number], string>>,
  run: () => void,
): void {
  const saved = GOOGLE_ENV.map((name) => [name, process.env[name]] as const);
  for (const name of GOOGLE_ENV) {
    delete process.env[name];
  }
  Object.assign(process.env, values);
  try {
    run();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

test("isGoogleConfigured finds the ADC file under HOME when CLOUDSDK_CONFIG is empty", () => {
  const home = mkdtempSync(join(tmpdir(), "seo-mcp-home-"));
  mkdirSync(join(home, ".config", "gcloud"), { recursive: true });
  writeFileSync(join(home, ".config", "gcloud", "application_default_credentials.json"), "{}");
  withEnv({ HOME: home, CLOUDSDK_CONFIG: "" }, () => {
    assert.equal(isGoogleConfigured(), true);
  });
});

test("a credentials path that cannot be read reports only its base name", () => {
  const dir = mkdtempSync(join(tmpdir(), "seo-mcp-secret-dir-"));
  withEnv({ GOOGLE_APPLICATION_CREDENTIALS: dir }, () => {
    assert.throws(
      () => getSearchConsoleClient(),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(
          err.message,
          /Failed to read credentials file "seo-mcp-secret-dir-\w+" \(EISDIR\)/,
        );
        assert.ok(!err.message.includes(tmpdir()));
        return true;
      },
    );
  });
});
