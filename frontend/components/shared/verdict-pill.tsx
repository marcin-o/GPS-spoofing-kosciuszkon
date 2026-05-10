"use client";

import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/verdict";

interface VerdictPillProps {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
  className?: string;
}

const SIZING: Record<NonNullable<VerdictPillProps["size"]>, string> = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-0.5 gap-1.5",
  lg: "text-sm px-3 py-1 gap-1.5",
};

const STYLES: Record<Verdict, string> = {
  OK: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  WARNING: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  CRITICAL: "bg-red-500/20 border-red-500/50 text-red-300",
};

const DOT: Record<Verdict, string> = {
  OK: "bg-emerald-400",
  WARNING: "bg-amber-400",
  CRITICAL: "bg-red-500",
};

export function VerdictPill({ verdict, size = "md", pulse = true, className }: VerdictPillProps) {
  const dotSize = size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5";
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono uppercase tracking-wider border rounded-sm",
        STYLES[verdict],
        SIZING[size],
        className,
      )}
      data-verdict={verdict}
    >
      <span
        aria-hidden
        className={cn(
          "rounded-full",
          dotSize,
          DOT[verdict],
          verdict === "CRITICAL" && pulse && "animate-pulse",
        )}
      />
      {verdict}
    </span>
  );
}
