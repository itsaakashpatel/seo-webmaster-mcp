import type { AnalyticsRow, AnalyticsSummary } from "./types.js";

/** Divides safely: returns 0 when the denominator is 0. */
export function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/** Totals the rows. The overall position is weighted by impressions. */
export function summarizeRows(rows: readonly AnalyticsRow[]): AnalyticsSummary {
  const totals = rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
      weightedPosition: acc.weightedPosition + row.position * row.impressions,
    }),
    { clicks: 0, impressions: 0, weightedPosition: 0 },
  );
  return {
    totalClicks: totals.clicks,
    totalImpressions: totals.impressions,
    overallCtr: `${(ratio(totals.clicks, totals.impressions) * 100).toFixed(2)}%`,
    overallPosition: ratio(totals.weightedPosition, totals.impressions).toFixed(1),
  };
}
