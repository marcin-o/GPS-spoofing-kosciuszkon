"use client";

import { cn } from "@/lib/utils";
import { verdictBg, verdictDot, type Verdict } from "@/lib/verdict";

interface VerdictPillProps {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

export function VerdictPill({ verdict, size = "md", pulse = true }: VerdictPillProps) {
  const sizing = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-0.5",
    lg: "text-sm px-3 py-1",
  }[size];
  const dotSize = size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono uppercase tracking-wider border rounded-sm",
        verdictBg[verdict],
        sizing,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "rounded-full",
          dotSize,
          verdictDot[verdict],
          verdict === "CRITICAL" && pulse && "animate-pulse",
        )}
      />
      {verdict}
    </span>
  );
}
