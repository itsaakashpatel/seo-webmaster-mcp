import test from "node:test";
import assert from "node:assert/strict";
import { formatBingError, isBingConfigured } from "../build/providers/bing/auth.js";
import { BingWebmasterProvider } from "../build/providers/bing/provider.js";
import { formatGoogleError, isGoogleConfigured } from "../build/providers/google/auth.js";
import {
  GoogleSearchConsoleProvider,
  normalizeGoogleDimensions,
} from "../build/providers/google/provider.js";
import { isIndexNowConfigured } from "../build/providers/indexnow/provider.js";

test("formatBingError formats 401 unauthorized with setup guidance", () => {
  const err = { code: 401, message: "Invalid API Key" };
  const msg = formatBingError(err);
  assert.ok(msg.includes("401 Invalid API Key"));
  assert.ok(msg.includes("BING_WEBMASTER_API_KEY"));
});

test("formatBingError formats 403 forbidden", () => {
  const err = { code: 403, message: "Access denied" };
  const msg = formatBingError(err);
  assert.ok(msg.includes("Bing Webmaster permission denied (403)"));
});

test("formatGoogleError formats 403 permission error with user role tip", () => {
  const err = { code: 403, message: "User does not have sufficient permission" };
  const msg = formatGoogleError(err);
  assert.ok(msg.includes("Permission error (403)"));
  assert.ok(msg.includes("Restricted"));
});

test("formatGoogleError formats 429 quota error", () => {
  const err = { code: 429, message: "Quota exceeded" };
  const msg = formatGoogleError(err);
  assert.ok(msg.includes("Quota exceeded (429)"));
  assert.ok(msg.includes("200 publish requests per day"));
});

test("normalizeGoogleDimensions filters unsupported dimensions", () => {
  const result = normalizeGoogleDimensions(["query", "invalid_dim", "page", "date"]);
  assert.deepEqual(result, ["query", "page", "date"]);
});

test("BingWebmasterProvider implements SearchEngineProvider contract", () => {
  const provider = new BingWebmasterProvider();
  assert.equal(provider.engine, "bing");
  assert.equal(provider.displayName, "Bing Webmaster Tools");
  assert.equal(typeof provider.isConfigured, "function");
  assert.equal(typeof provider.listSites, "function");
  assert.equal(typeof provider.queryAnalytics, "function");
  assert.equal(typeof provider.inspectUrl, "function");
  assert.equal(typeof provider.listSitemaps, "function");
  assert.equal(typeof provider.getSitemap, "function");
});

test("GoogleSearchConsoleProvider implements SearchEngineProvider contract", () => {
  const provider = new GoogleSearchConsoleProvider();
  assert.equal(provider.engine, "google");
  assert.equal(provider.displayName, "Google Search Console");
  assert.equal(typeof provider.isConfigured, "function");
  assert.equal(typeof provider.listSites, "function");
  assert.equal(typeof provider.queryAnalytics, "function");
  assert.equal(typeof provider.inspectUrl, "function");
  assert.equal(typeof provider.listSitemaps, "function");
  assert.equal(typeof provider.getSitemap, "function");
});

test("Configuration helpers safely check environment without throwing", () => {
  assert.equal(typeof isBingConfigured(), "boolean");
  assert.equal(typeof isGoogleConfigured(), "boolean");
  assert.equal(typeof isIndexNowConfigured(), "boolean");
});
