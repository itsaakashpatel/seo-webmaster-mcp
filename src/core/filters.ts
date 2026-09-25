import { buildSafeRegExp } from "./validation.js";

export type FilterMode = "contains" | "equals" | "regex";

/** A parsed text filter. The same grammar applies to Google (server side) and Bing (client side). */
export interface TextFilter {
  readonly mode: FilterMode;
  readonly negate: boolean;
  readonly expression: string;
}

interface FilterPrefix {
  readonly prefix: string;
  readonly mode: FilterMode;
  readonly negate: boolean;
}

// Order matters: a longer prefix must come before a shorter prefix that it starts with.
const FILTER_PREFIXES: readonly FilterPrefix[] = [
  { prefix: "!regex:", mode: "regex", negate: true },
  { prefix: "regex:", mode: "regex", negate: false },
  { prefix: "!exact:", mode: "equals", negate: true },
  { prefix: "!=", mode: "equals", negate: true },
  { prefix: "exact:", mode: "equals", negate: false },
  { prefix: "!", mode: "contains", negate: true },
];
const CONTAINS: FilterPrefix = { prefix: "", mode: "contains", negate: false };

/**
 * Parses the filter grammar: plain text (contains), `!text` (does not contain), `exact:` / `!exact:`
 * or `!=` (equals / does not equal), and `regex:` / `!regex:` (RE2 pattern).
 */
export function parseTextFilter(raw: string, label: string): TextFilter {
  const trimmed = raw.trim();
  const { prefix, mode, negate } =
    FILTER_PREFIXES.find((candidate) => trimmed.startsWith(candidate.prefix)) ?? CONTAINS;
  const expression = trimmed.slice(prefix.length).trim();
  if (expression.length === 0) {
    throw new Error(`Invalid ${label}: "${prefix || "filter"}" needs a non-empty value.`);
  }
  if (mode === "regex") {
    buildSafeRegExp(expression, label);
  }
  return { mode, negate, expression };
}

function buildMatcher({ mode, expression }: TextFilter): (text: string) => boolean {
  if (mode === "regex") {
    const regex = buildSafeRegExp(expression, "filter");
    return (text) => regex.test(text);
  }
  const needle = expression.toLowerCase();
  return mode === "equals"
    ? (text) => text.toLowerCase() === needle
    : (text) => text.toLowerCase().includes(needle);
}

/** Builds a case-insensitive predicate for client-side filtering. */
export function createTextMatcher(filter: TextFilter): (text: string) => boolean {
  const matches = buildMatcher(filter);
  return filter.negate ? (text) => !matches(text) : matches;
}
