import test from "node:test";
import assert from "node:assert/strict";
import { createTextMatcher, parseTextFilter } from "../build/core/filters.js";

test("parseTextFilter maps each prefix to a mode and negation", () => {
  const cases: Array<[string, string, boolean, string]> = [
    ["seo tools", "contains", false, "seo tools"],
    ["!brand", "contains", true, "brand"],
    ["exact:seo", "equals", false, "seo"],
    ["!exact:seo", "equals", true, "seo"],
    ["!=seo", "equals", true, "seo"],
    ["regex:^best", "regex", false, "^best"],
    ["!regex:^best", "regex", true, "^best"],
  ];
  for (const [raw, mode, negate, expression] of cases) {
    assert.deepEqual(parseTextFilter(raw, "queryFilter"), { mode, negate, expression }, raw);
  }
});

test("parseTextFilter rejects an empty value and an invalid regex", () => {
  assert.throws(
    () => parseTextFilter("exact:  ", "queryFilter"),
    /"exact:" needs a non-empty value/,
  );
  assert.throws(() => parseTextFilter("   ", "queryFilter"), /"filter" needs a non-empty value/);
  assert.throws(() => parseTextFilter("regex:(a)\\1", "queryFilter"), /Invalid queryFilter regex/);
});

function matches(raw: string, text: string): boolean {
  return createTextMatcher(parseTextFilter(raw, "queryFilter"))(text);
}

test("createTextMatcher matches case-insensitively and honors negation", () => {
  assert.equal(matches("SEO", "best seo tools"), true);
  assert.equal(matches("!seo", "best seo tools"), false);
  assert.equal(matches("exact:Best SEO Tools", "best seo tools"), true);
  assert.equal(matches("!=best seo tools", "best seo tools"), false);
  assert.equal(matches("regex:^best", "Best SEO"), true);
  assert.equal(matches("!regex:^best", "Best SEO"), false);
});
