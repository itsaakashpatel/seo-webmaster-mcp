import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDateRange,
  buildSafeRegExp,
  normalizeHost,
  normalizeSitemapKey,
  clampRowLimit,
  clampStartRow,
  normalizeDimensions,
  parseDimensionList,
} from "../build/core/validation.js";

test("validateDateRange accepts valid chronological YYYY-MM-DD dates", () => {
  assert.doesNotThrow(() => validateDateRange("2026-01-01", "2026-01-31"));
  assert.doesNotThrow(() => validateDateRange("2026-06-15", "2026-06-15"));
});

test("validateDateRange rejects invalid date format or out-of-order range", () => {
  assert.throws(() => validateDateRange("01-01-2026", "2026-01-31"), {
    message: /Invalid date format/,
  });
  assert.throws(() => validateDateRange("2026-02-01", "2026-01-01"), {
    message: /startDate "2026-02-01" is after endDate "2026-01-01"/,
  });
  assert.throws(() => validateDateRange("2026-13-45", "2026-12-31"), {
    message: /Invalid date format|Invalid calendar date/,
  });
});

test("buildSafeRegExp compiles valid regex case-insensitively", () => {
  const re: RegExp = buildSafeRegExp("^https://example\\.com/blog", "test");
  assert.ok(re instanceof RegExp);
  assert.ok(re.test("HTTPS://EXAMPLE.COM/BLOG/POST-1"));
});

test("buildSafeRegExp rejects empty pattern, oversized pattern, and syntax error", () => {
  assert.throws(() => buildSafeRegExp("", "test"), {
    message: /pattern is empty/,
  });
  assert.throws(() => buildSafeRegExp("a".repeat(201), "test"), {
    message: /exceeds 200 chars/,
  });
  assert.throws(() => buildSafeRegExp("[unclosed", "test"), {
    message: /Invalid test regex/,
  });
});

test("normalizeHost handles raw domains, prefixes, and ports", () => {
  assert.equal(normalizeHost("example.com"), "example.com");
  assert.equal(normalizeHost("HTTPS://example.com/"), "example.com");
  assert.equal(normalizeHost("http://sub.example.co.uk:8080/path"), "sub.example.co.uk");
});

test("normalizeHost rejects invalid domain strings", () => {
  assert.throws(() => normalizeHost("not a host"), {
    message: /Invalid host/,
  });
  assert.throws(() => normalizeHost("localhost"), {
    message: /Invalid host/,
  });
});

test("normalizeSitemapKey strips trailing slashes and normalizes host/path", () => {
  assert.equal(normalizeSitemapKey("https://example.com/sitemap.xml/"), "example.com/sitemap.xml");
  assert.equal(normalizeSitemapKey("/sitemaps/posts.xml/"), "/sitemaps/posts.xml");
});

test("clampRowLimit respects bounds and falls back on NaN/undefined", () => {
  assert.equal(clampRowLimit(50, 1000, 100), 50);
  assert.equal(clampRowLimit(5000, 1000, 100), 1000);
  assert.equal(clampRowLimit(-10, 1000, 100), 1);
  assert.equal(clampRowLimit(undefined, 1000, 100), 100);
  assert.equal(clampRowLimit(Number.NaN, 1000, 100), 100);
  assert.equal(clampRowLimit(42.8, 1000, 100), 42);
});

test("clampStartRow clamps to non-negative integer", () => {
  assert.equal(clampStartRow(10), 10);
  assert.equal(clampStartRow(-5), 0);
  assert.equal(clampStartRow(undefined), 0);
  assert.equal(clampStartRow(Number.NaN), 0);
  assert.equal(clampStartRow(15.9), 15);
});

test("normalizeDimensions and parseDimensionList canonicalize dimension names", () => {
  assert.deepEqual(normalizeDimensions(["QUERY", "Page", "Country"]), ["query", "page", "country"]);
  assert.deepEqual(normalizeDimensions(["searchAppearance", "date"]), ["searchAppearance", "date"]);
  assert.deepEqual(normalizeDimensions([]), ["query"]);
  assert.deepEqual(normalizeDimensions(undefined), ["query"]);
  assert.deepEqual(parseDimensionList("query, page, device"), ["query", "page", "device"]);
  assert.deepEqual(parseDimensionList(""), ["query"]);
  assert.deepEqual(parseDimensionList(undefined), ["query"]);
});
