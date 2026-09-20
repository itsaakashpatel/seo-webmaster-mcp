import test from "node:test";
import assert from "node:assert/strict";
import { truncateBody, getFetchTimeoutMs } from "../build/core/http.js";

test("truncateBody preserves strings within character limit", () => {
  const short: string = "Short error message";
  assert.equal(truncateBody(short, 100), short);
});

test("truncateBody truncates and adds indicator when exceeding maxChars", () => {
  const long: string = "A".repeat(150);
  const truncated: string = truncateBody(long, 50);
  assert.equal(truncated.length, 50 + "…(truncated)".length);
  assert.ok(truncated.endsWith("…(truncated)"));
});

test("getFetchTimeoutMs returns default timeout in milliseconds", () => {
  assert.equal(getFetchTimeoutMs(), 15000);
});
