"use client";

import { Plane } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { OnboardTick } from "@/lib/types";
import { fmtAlt, fmtCoord } from "@/lib/format";
import { ScoreBar } from "./score-bar";
import { TopReasons } from "./top-reasons";
import { VerdictPill } from "./verdict-pill";
import { ExplainModal } from "./explain-modal";

interface OnboardMonitorProps {
  tick: OnboardTick | null;
  history: OnboardTick[];
  scenarioName: string;
}

export function OnboardMonitor({ tick, history, scenarioName }: OnboardMonitorProps) {
  const [explainOpen, setExplainOpen] = useState(false);
  const alertFeedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (alertFeedRef.current) {
      alertFeedRef.current.scrollTop = 0;
    }
  }, [tick?.tick]);

  const l1History = history.map((t) => t.scores.L1.ratio);
  const l2History = history.map((t) => t.scores.L2.ratio);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 p-4 flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col gap-4 min-h-0">
        {/* Header card: callsign / position / verdict */}
        <div className="border border-slate-800 bg-slate-900/60 rounded-sm p-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 text-slate-400" aria-hidden />
            <div className="flex flex-col leading-none">
              <span className="font-mono font-semibold text-xl tracking-tight" data-testid="callsign">
                {tick?.callsign ?? "—"}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">
                {scenarioName}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] tracking-wider uppercase text-slate-500">Position</span>
            <span className="font-mono tabular-nums text-sm">
              {tick ? fmtCoord(tick.position.lat, tick.position.lon) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] tracking-wider uppercase text-slate-500">Altitude</span>
            <span className="font-mono tabular-nums text-sm">{tick ? fmtAlt(tick.position.alt) : "—"}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] tracking-wider uppercase text-slate-500">Heading</span>
            <span className="font-mono tabular-nums text-sm">
              {tick ? `${tick.position.heading.toFixed(0)}°` : "—"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {tick && <VerdictPill verdict={tick.verdict} size="lg" />}
            <button
              onClick={() => setExplainOpen(true)}
              className="text-xs uppercase tracking-wider text-slate-300 hover:text-white border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-sm transition-colors"
            >
              Explain
            </button>
          </div>
        </div>

        {/* Twin score bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tick ? (
            <>
              <ScoreBar
                label="Layer L1 — Signal (TEXBAT)"
                ratio={tick.scores.L1.ratio}
                threshold={tick.scores.L1.threshold}
                modelVersion={tick.scores.L1.model_version}
                f1={0.984}
                history={l1History}
                layer="L1"
              />
              <ScoreBar
                label="Layer L2 — Channel (Aissou)"
                ratio={tick.scores.L2.ratio}
                threshold={tick.scores.L2.threshold}
                modelVersion={tick.scores.L2.model_version}
                f1={0.976}
                history={l2History}
                layer="L2"
              />
            </>
          ) : (
            <div className="col-span-2 text-slate-500 text-sm font-mono tracking-wider uppercase border border-slate-800 rounded-sm p-6 text-center">
              Waiting for first tick…
            </div>
          )}
        </div>

        {/* Top reasons strip */}
        <TopReasons reasons={tick?.top_reasons ?? []} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-auto">
          <Stat label="Tick" value={tick ? `#${tick.tick}` : "—"} />
          <Stat label="Dominant" value={tick?.dominant_layer ?? "—"} />
          <Stat
            label="Inference"
            value={tick ? `${tick.inference_ms.xgboost.toFixed(1)} ms` : "—"}
          />
          <Stat label="Attack flag" value={tick ? (tick.is_attack ? "TRUE" : "false") : "—"} />
        </div>
      </div>

      {/* Right column: alert feed */}
      <aside className="flex flex-col border border-slate-800 bg-slate-900/40 rounded-sm overflow-hidden min-h-0">
        <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] tracking-wider uppercase text-slate-400 font-medium">
            Alert feed
          </span>
          <span className="ml-auto font-mono text-[10px] text-slate-500">{history.length} ticks</span>
        </div>
        <div ref={alertFeedRef} className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1.5">
          {[...history].reverse().slice(0, 80).map((t) => (
            <AlertRow key={t.tick} tick={t} />
          ))}
        </div>
      </aside>

      {tick && (
        <ExplainModal
          open={explainOpen}
          onClose={() => setExplainOpen(false)}
          tickId={`${tick.scenario_id}-${tick.tick}`}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-800 bg-slate-900/40 rounded-sm px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[10px] tracking-wider uppercase text-slate-500">{label}</span>
      <span className="font-mono tabular-nums text-sm text-slate-200">{value}</span>
    </div>
  );
}

function AlertRow({ tick }: { tick: OnboardTick }) {
  const v = tick.verdict;
  const dotClass = v === "OK" ? "bg-emerald-400" : v === "WARNING" ? "bg-amber-400" : "bg-red-500";
  const txtClass = v === "OK" ? "text-emerald-400" : v === "WARNING" ? "text-amber-400" : "text-red-500";
  return (
    <div className="font-mono text-[11px] flex items-center gap-2 px-1.5 py-1 hover:bg-slate-900/60 rounded-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass} flex-none`} />
      <span className="text-slate-500 tabular-nums">#{tick.tick.toString().padStart(3, "0")}</span>
      <span className={`tabular-nums ${txtClass}`}>{tick.scores[tick.dominant_layer].ratio.toFixed(2)}×</span>
      <span className="text-slate-500">{tick.dominant_layer}</span>
      <span className={`uppercase tracking-wider ml-auto text-[10px] ${txtClass}`}>{v}</span>
    </div>
  );
}
