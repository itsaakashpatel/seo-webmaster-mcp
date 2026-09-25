import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRows } from "../build/core/analytics.js";
import { escapeCell, fieldList, formatDate, markdownTable } from "../build/core/markdown.js";

test("markdownTable renders a header, a separator, and escaped rows", () => {
  const table = markdownTable(
    ["Query", "Clicks"],
    [
      ["a|b", 3],
      ["line\nbreak", 1],
    ],
  );
  assert.equal(
    table,
    ["| Query | Clicks |", "| --- | --- |", "| a\\|b | 3 |", "| line break | 1 |"].join("\n"),
  );
  assert.equal(escapeCell("x|y"), "x\\|y");
});

test("fieldList skips undefined values", () => {
  assert.deepEqual(
    fieldList([
      ["Verdict", "PASS"],
      ["Coverage", undefined],
      ["Errors", 0],
    ]),
    ["- **Verdict:** PASS", "- **Errors:** 0"],
  );
});

test("formatDate keeps the date part or returns the fallback", () => {
  assert.equal(formatDate("2026-09-24T10:00:00Z", "never"), "2026-09-24");
  assert.equal(formatDate(undefined, "never"), "never");
});

test("summarizeRows weights the position by impressions", () => {
  const summary = summarizeRows([
    { keys: ["a"], clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
    { keys: ["b"], clicks: 20, impressions: 300, ctr: 0.066, position: 4 },
  ]);
  assert.deepEqual(summary, {
    totalClicks: 30,
    totalImpressions: 400,
    overallCtr: "7.50%",
    overallPosition: "3.5",
  });
  assert.deepEqual(summarizeRows([]), {
    totalClicks: 0,
    totalImpressions: 0,
    overallCtr: "0.00%",
    overallPosition: "0.0",
  });
});
