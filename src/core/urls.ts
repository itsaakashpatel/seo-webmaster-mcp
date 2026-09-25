import { isRecord } from "./guards.js";

const JSON_ARRAY_ERROR = 'URL JSON must be an array of strings (e.g. ["https://..."]).';
const NON_STRING_ERROR = "URL JSON must be an array of strings; found non-string entry.";

/** Parses a value as an http(s) URL. Returns `undefined` for any other scheme or bad input. */
export function parseHttpUrl(value: string): URL | undefined {
  const trimmed = value.trim();
  if (!URL.canParse(trimmed)) {
    return undefined;
  }
  const url = new URL(trimmed);
  return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
}

export function isHttpUrl(value: string): boolean {
  return parseHttpUrl(value) !== undefined;
}

/** Trims each URL, drops empty entries, and removes duplicates. Keeps the first-seen order. */
export function dedupeUrls(urls: readonly string[]): string[] {
  return [...new Set(urls.map((url) => url.trim()).filter((url) => url.length > 0))];
}

/** Returns the entries that are not valid http(s) URLs. */
export function validateHttpsUrls(urls: readonly string[]): string[] {
  return urls.filter((url) => !isHttpUrl(url));
}

/** Returns the entries that are not http(s) URLs on exactly this host. */
export function urlsBelongToHost(urls: readonly string[], host: string): string[] {
  const expected = host.toLowerCase();
  return urls.filter((url) => parseHttpUrl(url)?.hostname.toLowerCase() !== expected);
}

function splitDelimitedList(text: string): string[] {
  return text
    .split(/[\r\n,]+/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}

function tryParseJson(text: string): unknown {
  try {
    const json: unknown = JSON.parse(text);
    return json;
  } catch {
    // Not JSON. The caller decides whether to fall back to a delimited list.
    return undefined;
  }
}

function toStringList(list: unknown): string[] {
  if (!Array.isArray(list)) {
    throw new Error(JSON_ARRAY_ERROR);
  }
  const strings = list.filter((entry): entry is string => typeof entry === "string");
  if (strings.length !== list.length) {
    throw new Error(NON_STRING_ERROR);
  }
  return strings.map((url) => url.trim()).filter((url) => url.length > 0);
}

/**
 * Parses a URL list from tool input. It accepts a JSON array, a JSON object with a `urls` array,
 * or a comma- or newline-separated list.
 */
export function parseUrlList(raw: string): string[] {
  const trimmed = raw.trim();
  const isJsonArray = trimmed.startsWith("[") && trimmed.endsWith("]");
  const isJsonObject = trimmed.startsWith("{") && trimmed.endsWith("}");
  if (!isJsonArray && !isJsonObject) {
    return splitDelimitedList(trimmed);
  }
  const parsed = tryParseJson(trimmed);
  if (parsed === undefined && isJsonArray) {
    // Tolerate an unquoted list such as [https://a.com, https://b.com].
    return splitDelimitedList(trimmed.slice(1, -1));
  }
  return toStringList(isRecord(parsed) ? parsed.urls : parsed);
}
