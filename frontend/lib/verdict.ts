export type Verdict = "OK" | "WARNING" | "CRITICAL";

export function verdictFor(ratio: number): Verdict {
  if (ratio >= 1.5) return "CRITICAL";
  if (ratio >= 1.0) return "WARNING";
  return "OK";
}

export const verdictColor: Record<Verdict, string> = {
  OK: "text-emerald-400",
  WARNING: "text-amber-400",
  CRITICAL: "text-red-500",
};

export const verdictBg: Record<Verdict, string> = {
  OK: "bg-emerald-500/15 border-emerald-500/40",
  WARNING: "bg-amber-500/15 border-amber-500/40",
  CRITICAL: "bg-red-500/20 border-red-500/50",
};

export const verdictDot: Record<Verdict, string> = {
  OK: "bg-emerald-400",
  WARNING: "bg-amber-400",
  CRITICAL: "bg-red-500",
};

export const verdictLabel: Record<Verdict, string> = {
  OK: "OK",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
};
