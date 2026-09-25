import { RE2JS } from "re2js";
import { MAX_REGEX_LENGTH } from "./constants.js";
import { isPresent } from "./guards.js";
import { DIMENSIONS, type Dimension } from "./types.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;
const DIMENSION_BY_KEY: ReadonlyMap<string, Dimension> = new Map(
  DIMENSIONS.map((dimension) => [dimension.toLowerCase(), dimension]),
);
const DEFAULT_DIMENSIONS: readonly Dimension[] = ["query"];

/** Trims a value and throws when nothing is left. */
export function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} must be non-empty.`);
  }
  return trimmed;
}

/** Maps dimension names to their canonical spelling. Drops unknown names and duplicates. */
export function normalizeDimensions(input: readonly string[] = []): Dimension[] {
  const known = input.map((raw) => DIMENSION_BY_KEY.get(raw.trim().toLowerCase()));
  const unique = [...new Set(known.filter(isPresent))];
  return unique.length > 0 ? unique : [...DEFAULT_DIMENSIONS];
}

export function parseDimensionList(raw: string | undefined): Dimension[] {
  return normalizeDimensions(raw?.split(",") ?? []);
}

function parseCalendarDate(value: string): number {
  const time = Date.parse(`${value}T00:00:00Z`);
  const isRealDate = !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
  if (!isRealDate) {
    throw new Error(`Invalid calendar date "${value}".`);
  }
  return time;
}

/** Checks the YYYY-MM-DD format, that both dates exist, and that start is not after end. */
export function validateDateRange(startDate: string, endDate: string): void {
  const start = startDate.trim();
  const end = endDate.trim();
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error(`Invalid date format. Use YYYY-MM-DD (got "${startDate}" to "${endDate}").`);
  }
  if (parseCalendarDate(start) > parseCalendarDate(end)) {
    throw new Error(`Invalid date range: startDate "${start}" is after endDate "${end}".`);
  }
}

/**
 * Compiles a user-supplied filter pattern with RE2 semantics.
 *
 * RE2 matches in linear time, so no pattern can cause catastrophic backtracking (ReDoS). It also
 * uses the same syntax as the Google Search Console API, so a `regex:` filter behaves the same
 * way on every engine.
 */
export function buildSafeRegExp(pattern: string, label: string): RE2JS {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    throw new Error(`Invalid ${label} regex: pattern is empty.`);
  }
  if (trimmed.length > MAX_REGEX_LENGTH) {
    throw new Error(`Invalid ${label} regex: pattern exceeds ${MAX_REGEX_LENGTH} chars.`);
  }
  try {
    return RE2JS.compile(trimmed, RE2JS.CASE_INSENSITIVE);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid ${label} regex "${trimmed}": ${msg}`, { cause: err });
  }
}

/** Reduces `https://Example.com:443/path` to `example.com`. */
export function normalizeHost(rawHost: string): string {
  const withoutScheme = rawHost
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "");
  const host = (withoutScheme.split(/[/:]/)[0] ?? "").replace(/\.+$/, "");
  if (!host.includes(".") || !HOST_RE.test(host)) {
    throw new Error(`Invalid host "${rawHost}". Use a bare domain like "example.com".`);
  }
  return host;
}

/** Builds a comparison key for a sitemap URL or path: lowercase, no scheme, no trailing slash. */
export function normalizeSitemapKey(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!URL.canParse(trimmed)) {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
  const url = new URL(trimmed);
  return `${url.hostname}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
}

export function clampRowLimit(
  requested: number | undefined,
  max: number,
  fallback: number,
): number {
  if (requested === undefined || !Number.isFinite(requested)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(requested), 1), max);
}

export function clampStartRow(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) {
    return 0;
  }
  return Math.max(Math.floor(requested), 0);
}
