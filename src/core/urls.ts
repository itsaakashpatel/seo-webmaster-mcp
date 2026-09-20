import { getErrorMessage } from "./errors.js";

export function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const trimmed: string = url.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

export function validateHttpsUrls(urls: string[]): string[] {
  const bad: string[] = [];
  for (const raw of urls) {
    try {
      const url = new URL(raw.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        bad.push(raw);
      }
    } catch {
      bad.push(raw);
    }
  }
  return bad;
}

export function urlsBelongToHost(urls: string[], host: string): string[] {
  const bad: string[] = [];
  const lowerHost: string = host.toLowerCase();
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        bad.push(raw);
        continue;
      }
      if (url.hostname.toLowerCase() !== lowerHost) {
        bad.push(raw);
      }
    } catch {
      bad.push(raw);
    }
  }
  return bad;
}

function parseJsonStringArray(trimmed: string): string[] {
  const parsed: unknown = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error("URL JSON must be an array of strings.");
  }
  const out: string[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "string") {
      throw new Error("URL JSON must be an array of strings; found non-string entry.");
    }
    const t: string = entry.trim();
    if (t.length > 0) {
      out.push(t);
    }
  }
  return out;
}

function splitDelimitedList(trimmed: string): string[] {
  return trimmed
    .split(/[\r\n,]+/)
    .map((u: string) => u.trim())
    .filter((u: string) => u.length > 0);
}

export function parseUrlList(raw: string): string[] {
  const trimmed: string = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && "urls" in parsed) {
        const candidate: unknown = (parsed as Record<string, unknown>)["urls"];
        if (Array.isArray(candidate)) {
          return parseJsonStringArray(JSON.stringify(candidate));
        }
      }
    } catch {
      // ignore
    }
    throw new Error('URL JSON must be an array of strings (e.g. ["https://..."]).');
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return parseJsonStringArray(trimmed);
    } catch (err: unknown) {
      const msg: string = getErrorMessage(err);
      if (msg.includes("must be an array of strings")) {
        throw err;
      }
      return splitDelimitedList(trimmed);
    }
  }
  return splitDelimitedList(trimmed);
}
