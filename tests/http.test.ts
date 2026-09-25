import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithTimeout, readJsonSafe, truncateBody } from "../build/core/http.js";

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

test("fetchWithTimeout reports only the host, never the query string", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  try {
    const url = new URL("https://api.example.com/path?apikey=SECRET123");
    await assert.rejects(fetchWithTimeout(url), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Request to api\.example\.com failed: fetch failed/);
      assert.ok(!err.message.includes("SECRET123"));
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("readJsonSafe includes a truncated body when the server sends HTML", async () => {
  const res = new Response("<html>Service Unavailable</html>", { status: 503 });
  await assert.rejects(
    readJsonSafe(res),
    /Invalid JSON response \(status 503\).*Service Unavailable/,
  );
});
