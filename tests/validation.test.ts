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
import { parseBingDate } from "../build/providers/bing/mappers.js";

test("validateDateRange accepts valid chronological YYYY-MM-DD dates", () => {
  assert.doesNotThrow(() => validateDateRange("2026-01-01", "2026-01-31"));
  assert.doesNotThrow(() => validateDateRange("2026-06-15", "2026-06-15"));
  assert.doesNotThrow(() => validateDateRange("2024-02-29", "2024-02-29")); // leap year
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

test("validateDateRange rejects non-existent calendar dates", () => {
  assert.throws(() => validateDateRange("2026-02-31", "2026-03-05"), {
    message: /Invalid calendar date "2026-02-31"/,
  });
  assert.throws(() => validateDateRange("2026-02-29", "2026-03-01"), {
    message: /Invalid calendar date "2026-02-29"/,
  });
  assert.throws(() => validateDateRange("2026-04-31", "2026-05-01"), {
    message: /Invalid calendar date "2026-04-31"/,
  });
});

test("buildSafeRegExp compiles valid regex case-insensitively", () => {
  const re = buildSafeRegExp("^https://example\\.com/blog", "test");
  assert.ok(re.test("HTTPS://EXAMPLE.COM/BLOG/POST-1"));

  const alt = buildSafeRegExp("shoes|boots", "test");
  assert.ok(alt.test("running shoes"));

  const group = buildSafeRegExp("(buy|cheap)+ shoes", "test");
  assert.ok(group.test("buy cheap shoes"));
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

test("buildSafeRegExp rejects syntax that RE2 does not support", () => {
  assert.throws(() => buildSafeRegExp("(a)\\1", "test"), { message: /Invalid test regex/ });
  assert.throws(() => buildSafeRegExp("foo(?=bar)", "test"), { message: /Invalid test regex/ });
});

test("buildSafeRegExp matches in linear time for catastrophic patterns", () => {
  const cases: Array<[string, string]> = [
    ["^(a|a)*$", "a".repeat(5000) + "!"],
    ["(a+)+$", "a".repeat(5000) + "!"],
    [".*.*.*.*.*.*.*.*.*.*x", "a".repeat(5000)],
    ["^" + "(a|a)?".repeat(22) + "$", "a".repeat(22) + "!"],
  ];
  const start = performance.now();
  for (const [pattern, input] of cases) {
    assert.equal(buildSafeRegExp(pattern, "test").test(input), false);
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 500, `RE2 matching took ${elapsed}ms; expected linear time (<500ms)`);
});

test("parseBingDate parses WCF formats and ISO strings", () => {
  const wcf1 = parseBingDate("/Date(1690000000000-0700)/");
  assert.ok(wcf1);
  assert.equal(typeof wcf1, "string");
  assert.ok(wcf1.startsWith("2023-07-22"));

  const wcf2 = parseBingDate("/Date(1690000000000)/");
  assert.ok(wcf2);
  assert.equal(typeof wcf2, "string");
  assert.ok(wcf2.startsWith("2023-07-22"));

  const iso = parseBingDate("2026-03-01T00:00:00.000Z");
  assert.equal(iso, "2026-03-01T00:00:00.000Z");

  assert.equal(parseBingDate(""), undefined);
  assert.equal(parseBingDate(null), undefined);
  assert.equal(parseBingDate(undefined), undefined);
  assert.equal(parseBingDate("not a date"), undefined);
  // Finite but outside the Date range: must not throw RangeError.
  assert.equal(parseBingDate("/Date(99999999999999999)/"), undefined);
  assert.equal(parseBingDate(1e17), undefined);
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
