"use client";

import { cn } from "@/lib/utils";
import { fmtRatio } from "@/lib/format";
import { verdictFor } from "@/lib/verdict";
import { useEffect, useState } from "react";

interface ScoreBarProps {
  label: string;
  ratio: number;
  threshold: number;
  modelVersion: string;
  f1?: number;
  history?: number[];
  layer?: "L1" | "L2" | "ENSEMBLE";
  thin?: boolean;
}

const MAX_DISPLAY = 2.0;

export function ScoreBar({
  label,
  ratio,
  threshold,
  modelVersion,
  f1,
  history,
  layer,
  thin = false,
}: ScoreBarProps) {
  const verdict = verdictFor(ratio);
  const clipped = Math.min(MAX_DISPLAY, Math.max(0, ratio));
  const widthPct = (clipped / MAX_DISPLAY) * 100;
  const overflow = ratio > MAX_DISPLAY;

  return (
    <div className={cn("flex flex-col gap-1.5", thin ? "" : "p-3 border border-slate-800 bg-slate-900/60 rounded-sm")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] tracking-wider uppercase text-slate-400 font-medium">
          {label}
          {layer && <span className="ml-2 text-slate-500 font-mono">[{layer}]</span>}
        </span>
        <span
          className={cn(
            "font-mono tabular-nums text-lg font-semibold",
            verdict === "OK" && "text-emerald-400",
            verdict === "WARNING" && "text-amber-400",
            verdict === "CRITICAL" && "text-red-500",
          )}
        >
          {fmtRatio(ratio)}
          {overflow && <span className="text-xs ml-1 text-slate-500">↑</span>}
        </span>
      </div>

      <div className={cn("relative w-full bg-slate-950 border border-slate-800 rounded-sm overflow-hidden", thin ? "h-1.5" : "h-2.5")}>
        <div
          className={cn(
            "absolute inset-y-0 left-0 transition-all duration-300 ease-out",
            verdict === "OK" && "bg-emerald-500/70",
            verdict === "WARNING" && "bg-amber-500/80",
            verdict === "CRITICAL" && "bg-red-500/90",
          )}
          style={{ width: `${widthPct}%` }}
        />
        {/* Threshold marker (1.0) */}
        <div
          className="absolute inset-y-0 border-l border-dashed border-slate-400/70"
          style={{ left: `${(1.0 / MAX_DISPLAY) * 100}%` }}
          aria-hidden
        />
        {/* Critical marker (1.5) */}
        <div
          className="absolute inset-y-0 border-l border-dashed border-red-400/80"
          style={{ left: `${(1.5 / MAX_DISPLAY) * 100}%` }}
          aria-hidden
        />
      </div>

      {!thin && (
        <div className="flex justify-between items-baseline">
          <div className="font-mono text-[10px] text-slate-500 tracking-wider uppercase">
            <span>PRÓG: {threshold.toFixed(2)}</span>
            {f1 !== undefined && <span className="ml-3">F1: {f1.toFixed(3)}</span>}
            <span className="ml-3 text-slate-600">{modelVersion}</span>
          </div>
          <div className="flex gap-3 font-mono text-[10px] text-slate-500">
            <span><span className="text-slate-400">─ ─ ─</span> 1.0×</span>
            <span><span className="text-red-400">─ ─ ─</span> 1.5×</span>
          </div>
        </div>
      )}

      {history && history.length > 1 && !thin && (
        <Sparkline values={history} verdict={verdict} />
      )}
    </div>
  );
}

function Sparkline({ values, verdict }: { values: number[]; verdict: "OK" | "WARNING" | "CRITICAL" }) {
  const [w, setW] = useState(280);
  const h = 32;
  const padded = values.slice(-60);
  const max = Math.max(MAX_DISPLAY, ...padded);
  const dx = padded.length > 1 ? w / (padded.length - 1) : 0;
  const points = padded.map((v, i) => {
    const x = i * dx;
    const y = h - (Math.min(v, MAX_DISPLAY) / MAX_DISPLAY) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  useEffect(() => {
    function onResize() {
      const el = document.querySelector("[data-spark]");
      if (el instanceof HTMLElement) setW(el.clientWidth);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const stroke = verdict === "OK" ? "#34d399" : verdict === "WARNING" ? "#fbbf24" : "#f87171";

  return (
    <div data-spark className="w-full mt-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
        {/* Threshold reference line */}
        <line
          x1={0} x2={w}
          y1={h - (1.0 / MAX_DISPLAY) * (h - 2) - 1}
          y2={h - (1.0 / MAX_DISPLAY) * (h - 2) - 1}
          stroke="#475569" strokeDasharray="2 3" strokeWidth={0.6}
        />
        <polyline
          points={points}
          fill="none"
          stroke={stroke}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
