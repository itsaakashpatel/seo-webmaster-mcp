export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_REGEX_LEN = 200;
export const MAX_INDEXNOW_URLS = 10000;
export const MAX_GOOGLE_INDEXING_URLS = 200;

export { dedupeUrls, validateHttpsUrls, urlsBelongToHost, parseUrlList } from "./urls.js";

const CANONICAL_DIMENSIONS: Record<string, string> = {
  query: "query",
  page: "page",
  country: "country",
  device: "device",
  searchappearance: "searchAppearance",
  date: "date",
};

export function normalizeDimensions(input: readonly string[] | undefined): string[] {
  if (!input || input.length === 0) {
    return ["query"];
  }
  const out: string[] = [];
  for (const raw of input) {
    const key: string = raw.trim().toLowerCase();
    const canonical: string | undefined = CANONICAL_DIMENSIONS[key];
    if (canonical && !out.includes(canonical)) {
      out.push(canonical);
    }
  }
  return out.length > 0 ? out : ["query"];
}

export function parseDimensionList(raw: string | undefined): string[] {
  if (!raw || raw.trim().length === 0) {
    return ["query"];
  }
  const parts: string[] = raw
    .split(",")
    .map((d: string) => d.trim())
    .filter((d: string) => d.length > 0);
  return normalizeDimensions(parts);
}

export function validateDateRange(startDate: string, endDate: string): void {
  const start: string = startDate.trim();
  const end: string = endDate.trim();
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error(`Invalid date format. Use YYYY-MM-DD (got "${startDate}" to "${endDate}").`);
  }
  const startObj = new Date(start + "T00:00:00Z");
  const endObj = new Date(end + "T00:00:00Z");
  const startIso: string = !Number.isNaN(startObj.getTime())
    ? startObj.toISOString().slice(0, 10)
    : "";
  const endIso: string = !Number.isNaN(endObj.getTime()) ? endObj.toISOString().slice(0, 10) : "";

  if (startIso !== start) {
    throw new Error(`Invalid calendar date "${startDate}".`);
  }
  if (endIso !== end) {
    throw new Error(`Invalid calendar date "${endDate}".`);
  }
  if (startObj.getTime() > endObj.getTime()) {
    throw new Error(`Invalid date range: startDate "${start}" is after endDate "${end}".`);
  }
}

export function parseBingDate(raw: unknown): string | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") {
    return undefined;
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) {
      return undefined;
    }
    try {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch {
      return undefined;
    }
  }
  const trimmed: string = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const wcfMatch = /^\/?Date\(([+-]?\d+)(?:[+-]\d{4})?\)\/?$/i.exec(trimmed);
  if (wcfMatch && wcfMatch[1]) {
    const epochMs: number = Number(wcfMatch[1]);
    if (!Number.isFinite(epochMs)) {
      return undefined;
    }
    try {
      const d = new Date(epochMs);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch {
      return undefined;
    }
  }
  const parsed: number = Date.parse(trimmed);
  if (Number.isFinite(parsed)) {
    try {
      const d = new Date(parsed);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function hasCatastrophicPattern(pattern: string): boolean {
  let normalized: string = pattern.replace(/\\./g, "_");
  normalized = normalized.replace(/\[(?:[^\]\\]|\\.)*\]/g, "_");

  if (/(?:[*+]|\{\d+,?\d*\})\s*(?:[*+]|\{\d+,?\d*\})/.test(normalized)) {
    return true;
  }

  let simplified: string = normalized;
  let prev = "";
  while (simplified !== prev) {
    prev = simplified;
    if (/\(([^()]*[+*?]|[^()]*\{\d+,?\d*\})[^()]*\)\s*([*+]|\{\d+,?\d*\})/.test(simplified)) {
      return true;
    }
    if (/\(([^()]*\|[^()]*)\)\s*([*+]|\{\d+,?\d*\})/.test(simplified)) {
      return true;
    }
    simplified = simplified.replace(/\([^()]+\)/g, "X");
  }
  return false;
}

export function buildSafeRegExp(pattern: string, label: string): RegExp {
  const trimmed: string = pattern.trim();
  if (trimmed.length === 0) {
    throw new Error(`Invalid ${label} regex: pattern is empty.`);
  }
  if (trimmed.length > MAX_REGEX_LEN) {
    throw new Error(`Invalid ${label} regex: pattern exceeds ${MAX_REGEX_LEN} chars.`);
  }
  if (hasCatastrophicPattern(trimmed)) {
    throw new Error(
      `Invalid ${label} regex "${trimmed}": pattern contains nested or repeated groups susceptible to catastrophic backtracking (ReDoS).`,
    );
  }
  try {
    return new RegExp(trimmed, "i");
  } catch (err: unknown) {
    const msg: string = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid ${label} regex "${trimmed}": ${msg}`, { cause: err });
  }
}

export function normalizeHost(rawHost: string): string {
  let host: string = rawHost.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "");
  host = host.split("/")[0] ?? "";
  host = host.split(":")[0] ?? "";
  host = host.replace(/\.+$/, "");
  if (host.length === 0 || host.includes(" ") || !host.includes(".")) {
    throw new Error(`Invalid host "${rawHost}". Use a bare domain like "example.com".`);
  }
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(host)) {
    throw new Error(`Invalid host "${rawHost}". Use a bare domain like "example.com".`);
  }
  return host;
}

export function normalizeSitemapKey(pathOrUrl: string): string {
  const trimmed: string = pathOrUrl.trim();
  if (trimmed.length === 0) {
    return "";
  }
  try {
    const url = new URL(trimmed);
    return (url.hostname.toLowerCase() + url.pathname.replace(/\/+$/, "")).toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

export function clampRowLimit(
  requested: number | undefined,
  max: number,
  fallback: number,
): number {
  if (requested === undefined || !Number.isFinite(requested)) {
    return fallback;
  }
  const floored: number = Math.floor(requested);
  return Math.min(Math.max(floored, 1), max);
}

export function clampStartRow(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) {
    return 0;
  }
  return Math.max(Math.floor(requested), 0);
}
