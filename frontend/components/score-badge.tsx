import { cn } from "@/lib/utils";
import type { AlertLevel } from "@/lib/api/types";

const STYLES: Record<AlertLevel, string> = {
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  critical: "bg-red-500/20 text-red-400 border-red-500/40",
};

const LABELS: Record<AlertLevel, string> = {
  ok: "OK",
  warn: "WARN",
  critical: "CRITICAL",
};

export function ScoreBadge({
  level,
  score,
  className,
}: {
  level: AlertLevel;
  score: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs font-medium",
        STYLES[level],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          level === "critical" && "animate-pulse",
          level === "ok" && "bg-emerald-400",
          level === "warn" && "bg-amber-400",
          level === "critical" && "bg-red-400",
        )}
      />
      {LABELS[level]} · {(score * 100).toFixed(0)}%
    </span>
  );
}
