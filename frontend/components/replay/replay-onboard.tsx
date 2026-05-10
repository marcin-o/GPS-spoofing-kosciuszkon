"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { OnboardTick } from "@/lib/types";
import { fmtAlt, fmtCoord } from "@/lib/format";
import { ScoreBar } from "@/components/dashboard/score-bar";
import { TopReasons } from "@/components/dashboard/top-reasons";
import { VerdictPill } from "@/components/shared/verdict-pill";
import type { AircraftTrail } from "./replay-map";
import type { LatLngTuple } from "leaflet";

const ReplayMapDynamic = dynamic(() => import("./replay-map").then((m) => m.ReplayMap), { ssr: false });

interface ReplayOnboardProps {
  ticks: OnboardTick[];
  currentTick: number;
}

const MODEL_LABELS: Record<string, string> = {
  "texbat-xgb-v1": "XGBoost — L1 Sygnał (TEXBAT)",
  "aissou-xgb-bin-v1": "XGBoost — L2 Kanał (Aissou)",
  "aissou-xgb-binary-v1": "XGBoost — L2 Kanał (Aissou)",
};

export function ReplayOnboard({ ticks, currentTick }: ReplayOnboardProps) {
  const tick = ticks[currentTick];

  const trail = useMemo<LatLngTuple[]>(() => {
    return ticks.slice(0, currentTick + 1).map((t) => [t.position.lat, t.position.lon]);
  }, [ticks, currentTick]);

  const aircraftTrails = useMemo<AircraftTrail[]>(() => {
    if (!tick) return [];
    return [{
      icao24: tick.callsign,
      callsign: tick.callsign,
      trail,
      currentPos: [tick.position.lat, tick.position.lon],
      heading: tick.position.heading,
      verdict: tick.verdict,
      selected: true,
    }];
  }, [tick, trail]);

  const l1History = useMemo(() => ticks.slice(0, currentTick + 1).map((t) => t.scores.L1.ratio), [ticks, currentTick]);
  const l2History = useMemo(() => ticks.slice(0, currentTick + 1).map((t) => t.scores.L2.ratio), [ticks, currentTick]);

  if (!tick) return null;

  const dom = tick.dominant_layer;
  const domScore = tick.scores[dom];
  const domModelLabel = MODEL_LABELS[domScore.model_version] ?? domScore.model_version;
  const verdictClass = tick.verdict === "CRITICAL"
    ? "text-red-500 border-red-500/40 bg-red-500/10"
    : tick.verdict === "WARNING"
    ? "text-amber-400 border-amber-400/40 bg-amber-400/10"
    : "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">

      {/* ── LEFT COLUMN: map (fixed height) + score bars below ── */}
      <div className="flex flex-col flex-1 lg:w-0 border-r border-slate-800 min-h-0 overflow-hidden">

        {/* Map — fixed height, never changes */}
        <div className="flex-none h-[300px] border-b border-slate-800">
          <ReplayMapDynamic aircraft={aircraftTrails} />
        </div>

        {/* Info strip below the map — position + altitude row */}
        <div className="flex-none border-b border-slate-800 bg-slate-900/60 px-4 py-2 flex flex-wrap items-center gap-5 text-xs font-mono">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] tracking-wider uppercase text-slate-500">Callsign</span>
            <span className="font-semibold text-slate-100">{tick.callsign}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] tracking-wider uppercase text-slate-500">Pozycja</span>
            <span className="tabular-nums text-slate-300">{fmtCoord(tick.position.lat, tick.position.lon)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] tracking-wider uppercase text-slate-500">Wysokość</span>
            <span className="tabular-nums text-slate-300">{fmtAlt(tick.position.alt)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] tracking-wider uppercase text-slate-500">Kurs</span>
            <span className="tabular-nums text-slate-300">{tick.position.heading.toFixed(0)}°</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] tracking-wider uppercase text-slate-500">Tick</span>
            <span className="tabular-nums text-slate-300">#{tick.tick}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] tracking-wider uppercase text-slate-500">Atak</span>
            <span className={tick.is_attack ? "text-red-400 font-semibold" : "text-slate-500"}>
              {tick.is_attack ? "TAK ⚠" : "nie"}
            </span>
          </div>
          <div className="ml-auto flex-none">
            <VerdictPill verdict={tick.verdict} size="md" />
          </div>
        </div>

        {/* Score bars — below map, scrollable if needed */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
          <ScoreBar
            label="Warstwa L1 — Sygnał (TEXBAT)"
            ratio={tick.scores.L1.ratio}
            threshold={tick.scores.L1.threshold}
            modelVersion={tick.scores.L1.model_version}
            f1={0.984}
            history={l1History}
            layer="L1"
          />
          <ScoreBar
            label="Warstwa L2 — Kanał (Aissou)"
            ratio={tick.scores.L2.ratio}
            threshold={tick.scores.L2.threshold}
            modelVersion={tick.scores.L2.model_version}
            f1={0.976}
            history={l2History}
            layer="L2"
          />

          {/* Layer comparison compact */}
          <div className="border border-slate-800 bg-slate-900/40 rounded-sm p-3 flex gap-3">
            {(["L1", "L2"] as const).map((layer) => {
              const s = tick.scores[layer];
              const isDom = dom === layer;
              const lv = s.ratio >= 1.5 ? "CRITICAL" : s.ratio >= 1.0 ? "WARNING" : "OK";
              const cls = lv === "CRITICAL" ? "text-red-500" : lv === "WARNING" ? "text-amber-400" : "text-emerald-400";
              return (
                <div key={layer}
                  className={`flex-1 border rounded-sm px-3 py-2 ${isDom ? "border-indigo-500/50 bg-indigo-500/5" : "border-slate-800"}`}
                >
                  <div className="text-[9px] tracking-wider uppercase text-slate-500 mb-0.5">
                    {layer}{isDom && <span className="text-indigo-400 ml-1">↑ dom</span>}
                  </div>
                  <div className={`font-mono font-semibold text-sm ${cls}`}>{s.ratio.toFixed(3)}×</div>
                  <div className="font-mono text-[9px] text-slate-500">proba {s.raw.toFixed(4)} / próg {s.threshold.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: fully scrollable analysis panel ── */}
      <aside className="flex flex-col flex-none lg:w-[380px] min-h-0 bg-slate-950 border-t lg:border-t-0 border-slate-800">
        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4">

          {/* Dominant model badge — always present in DOM, fades when OK */}
          <div
            className={`border rounded-sm px-4 py-3 flex items-start gap-3 transition-opacity duration-200 ${verdictClass} ${tick.verdict === "OK" ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            aria-hidden={tick.verdict === "OK"}
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-[10px] tracking-wider uppercase opacity-70">Anomalia wykryta przez</span>
              <span className="font-mono font-semibold text-sm truncate">{domModelLabel}</span>
              <span className="font-mono text-[11px] opacity-80">
                warstwa {dom} · ratio {domScore.ratio.toFixed(3)}× (próg {domScore.threshold.toFixed(2)})
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-none">
              <span className="text-[9px] tracking-wider uppercase opacity-60">Model</span>
              <span className="font-mono text-[10px]">{domScore.model_version}</span>
              <span className="font-mono text-[10px] opacity-60">F1: {dom === "L1" ? "0.984" : "0.976"}</span>
            </div>
          </div>

          <TopReasons reasons={tick.top_reasons} />

          {/* Tick metrics grid */}
          <div className="border border-slate-800 bg-slate-900/40 rounded-sm p-3 flex flex-col gap-2">
            <span className="text-[11px] tracking-wider uppercase text-slate-400 font-medium">Metryki ticku</span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Metric label="Tick #" value={String(tick.tick)} />
              <Metric label="Dominująca warstwa" value={dom} />
              <Metric label="L1 ratio" value={`${tick.scores.L1.ratio.toFixed(3)}×`} />
              <Metric label="L2 ratio" value={`${tick.scores.L2.ratio.toFixed(3)}×`} />
              <Metric label="L1 proba" value={tick.scores.L1.raw.toFixed(4)} />
              <Metric label="L2 proba" value={tick.scores.L2.raw.toFixed(4)} />
              <Metric label="Model L1" value={tick.scores.L1.model_version} small />
              <Metric label="Model L2" value={tick.scores.L2.model_version} small />
              <Metric label="Inferencja XGB" value={`${tick.inference_ms.xgboost.toFixed(1)} ms`} />
              <Metric label="Atak aktywny" value={tick.is_attack ? "TAK ⚠" : "nie"} />
            </div>
          </div>

        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] tracking-wider uppercase text-slate-500">{label}</span>
      <span className={`font-mono tabular-nums ${small ? "text-[10px]" : "text-xs"} text-slate-200 truncate`}>{value}</span>
    </div>
  );
}
