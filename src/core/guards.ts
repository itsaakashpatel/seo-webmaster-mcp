export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }
  throw new Error(`Invalid ${label}: expected an object.`);
}

/** Returns the object entries of an array, or an empty list when the value is not an array. */
export function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Removes `undefined`, `null`, `false`, and `""` from a list of optional items. */
export function compact<T>(items: ReadonlyArray<T | null | undefined | false | "">): T[] {
  return items.filter((item): item is T => Boolean(item));
}
