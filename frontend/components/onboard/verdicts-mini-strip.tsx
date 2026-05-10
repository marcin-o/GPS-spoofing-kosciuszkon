"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Verdict } from "@/lib/verdict";
import { cn } from "@/lib/utils";

interface VerdictsMiniStripProps {
  verdicts: Verdict[];
  windowSize?: number;
}

const COLOR: Record<Verdict, string> = {
  OK: "bg-emerald-500/70",
  WARNING: "bg-amber-500/80",
  CRITICAL: "bg-red-500",
};

export function VerdictsMiniStrip({ verdicts, windowSize = 30 }: VerdictsMiniStripProps) {
  const slice = verdicts.slice(-windowSize);
  const padding = Math.max(0, windowSize - slice.length);

  return (
    <div className="flex items-center gap-2 border border-slate-800 bg-slate-900/40 rounded-sm px-3 py-2">
      <span className="text-[10px] tracking-wider uppercase text-slate-500 font-medium">
        last {windowSize}
      </span>
      <div className="flex gap-[2px] flex-1">
        {Array.from({ length: padding }).map((_, i) => (
          <span
            key={`pad-${i}`}
            className="flex-1 h-3 rounded-[1px] bg-slate-900 border border-slate-800/50"
            aria-hidden
          />
        ))}
        {slice.map((v, i) => (
          <Tooltip key={`v-${i}`}>
            <TooltipTrigger
              render={
                <span
                  className={cn(
                    "flex-1 h-3 rounded-[1px] transition-colors cursor-default",
                    COLOR[v],
                    v === "CRITICAL" && "ring-1 ring-red-400/60",
                  )}
                  aria-label={`tick ${slice.length - i} verdict ${v}`}
                />
              }
            />
            <TooltipContent>
              <span className="font-mono text-[10px] uppercase tracking-wider">
                t-{slice.length - i - 1} · {v}
              </span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <span className="text-[10px] font-mono text-slate-500 tabular-nums">
        {slice.length}/{windowSize}
      </span>
    </div>
  );
}
