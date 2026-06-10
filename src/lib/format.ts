/** Display formatting helpers (pure, testable). */

export function fmt(x: number | undefined | null, dp = 2): string {
  if (x === undefined || x === null || !isFinite(x)) return "—";
  // Round to dp, then let Number drop trailing zeros ("15.80" -> "15.8").
  // String(-0) is "0", so tiny negatives can't render as "-0".
  return String(Number(x.toFixed(dp)));
}

export function num(s: string): number | undefined {
  if (s.trim() === "") return undefined;
  const v = Number(s.replace(",", "."));
  return isFinite(v) ? v : undefined;
}
