import test from "node:test";
import assert from "node:assert/strict";
import {
  dedupeUrls,
  validateHttpsUrls,
  urlsBelongToHost,
  parseUrlList,
} from "../build/core/urls.js";

test("dedupeUrls removes duplicates, trims whitespace, and ignores empty strings", () => {
  const input: string[] = [
    "  https://example.com/a  ",
    "https://example.com/b",
    "https://example.com/a",
    "",
    "   ",
    "https://example.com/c",
  ];
  const result: string[] = dedupeUrls(input);
  assert.deepEqual(result, [
    "https://example.com/a",
    "https://example.com/b",
    "https://example.com/c",
  ]);
});

test("dedupeUrls returns empty array on empty input", () => {
  assert.deepEqual(dedupeUrls([]), []);
  assert.deepEqual(dedupeUrls(["", "   "]), []);
});

test("validateHttpsUrls accepts valid http and https URLs", () => {
  const valid: string[] = [
    "https://example.com",
    "http://example.com/path?foo=bar#hash",
    "https://sub.example.co.uk/page",
  ];
  const bad: string[] = validateHttpsUrls(valid);
  assert.deepEqual(bad, []);
});

test("validateHttpsUrls detects invalid schemes and malformed URLs", () => {
  const invalid: string[] = [
    "ftp://example.com/file",
    "mailto:test@example.com",
    "javascript:void(0)",
    "not-a-url",
    "/relative/path",
  ];
  const bad: string[] = validateHttpsUrls(invalid);
  assert.deepEqual(bad, invalid);
});

test("urlsBelongToHost validates matching hostnames case-insensitively", () => {
  const urls: string[] = [
    "https://example.com/p1",
    "https://EXAMPLE.COM/p2",
    "http://example.com/p3",
  ];
  const bad: string[] = urlsBelongToHost(urls, "example.com");
  assert.deepEqual(bad, []);
});

test("urlsBelongToHost rejects mismatched hostnames and invalid protocols", () => {
  const urls: string[] = [
    "https://example.com/p1",
    "https://other.com/p2",
    "https://sub.example.com/p3",
    "ftp://example.com/p4",
  ];
  const bad: string[] = urlsBelongToHost(urls, "example.com");
  assert.deepEqual(bad, [
    "https://other.com/p2",
    "https://sub.example.com/p3",
    "ftp://example.com/p4",
  ]);
});

test("parseUrlList parses comma and newline delimited strings", () => {
  const raw =
    "https://example.com/1, https://example.com/2\nhttps://example.com/3\r\nhttps://example.com/4";
  const result: string[] = parseUrlList(raw);
  assert.deepEqual(result, [
    "https://example.com/1",
    "https://example.com/2",
    "https://example.com/3",
    "https://example.com/4",
  ]);
});

test("parseUrlList parses JSON string array format", () => {
  const raw = '["https://example.com/1", "https://example.com/2"]';
  const result: string[] = parseUrlList(raw);
  assert.deepEqual(result, ["https://example.com/1", "https://example.com/2"]);
});

test("parseUrlList throws when JSON is not an array of strings", () => {
  assert.throws(() => parseUrlList('{"url": "https://example.com"}'), {
    message: /URL JSON must be an array of strings/,
  });
  assert.throws(() => parseUrlList("[123, 456]"), {
    message: /found non-string entry/,
  });
});

test("parseUrlList returns empty array for empty or whitespace-only input", () => {
  assert.deepEqual(parseUrlList(""), []);
  assert.deepEqual(parseUrlList("   \n\r\n  "), []);
});
