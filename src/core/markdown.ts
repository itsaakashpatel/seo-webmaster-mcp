export type Cell = string | number;

/** Escapes a value so that it cannot break a Markdown table row. */
export function escapeCell(value: Cell): string {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function markdownTable(
  headers: readonly string[],
  rows: ReadonlyArray<readonly Cell[]>,
): string {
  const toRow = (cells: readonly Cell[]): string => `| ${cells.map(escapeCell).join(" | ")} |`;
  return [toRow(headers), toRow(headers.map(() => "---")), ...rows.map(toRow)].join("\n");
}

export function code(value: string): string {
  return `\`${value}\``;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatPercent(fraction: number): string {
  return `${(fraction * 100).toFixed(2)}%`;
}

/** Keeps only the date part of an ISO timestamp. */
export function formatDate(iso: string | undefined, fallback: string): string {
  return iso?.split("T")[0] ?? fallback;
}

/**
 * Renders `- **Label:** value` bullet lines. Entries with an `undefined` value are skipped, so
 * optional fields need no `if` statements.
 */
export function fieldList(fields: ReadonlyArray<readonly [string, Cell | undefined]>): string[] {
  return fields.flatMap(([label, value]) =>
    value === undefined ? [] : [`- **${label}:** ${value}`],
  );
}
