"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { AircraftEntry, GlobeTick } from "@/lib/types";
import { fmtCoord } from "@/lib/format";
import { ScoreBar } from "@/components/dashboard/score-bar";
import { TopReasons } from "@/components/dashboard/top-reasons";
import { VerdictPill } from "@/components/shared/verdict-pill";
import type { AircraftTrail } from "./replay-map";
import type { LatLngTuple } from "leaflet";

const ReplayMapDynamic = dynamic(() => import("./replay-map").then((m) => m.ReplayMap), { ssr: false });

interface ReplayGlobeProps {
  ticks: GlobeTick[];
  currentTick: number;
}

const SUBMODEL_LABELS: Record<string, { name: string; desc: string; f1: number }> = {
  iforest_v1: { name: "IsolationForest v1",              desc: "Anomalia w features bazowych (snapshot)",   f1: 0.891 },
  iforest_v2: { name: "IsolationForest v2 (multitime)",  desc: "Niespójność trajektorii w oknie czasowym",  f1: 0.912 },
};

export function ReplayGlobe({ ticks, currentTick }: ReplayGlobeProps) {
  const tick = ticks[currentTick];
  const [selectedIcao, setSelectedIcao] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!tick) return [];
    return [...tick.aircraft].sort((a, b) => b.ensemble_score.ratio - a.ensemble_score.ratio);
  }, [tick]);

  const selectedAc = useMemo<AircraftEntry | null>(() => {
    if (!sorted.length) return null;
    return sorted.find((a) => a.icao24 === selectedIcao) ?? sorted[0];
  }, [sorted, selectedIcao]);

  const aircraftTrails = useMemo<AircraftTrail[]>(() => {
    return sorted.map((ac) => {
      const trail: LatLngTuple[] = ticks
        .slice(0, currentTick + 1)
        .map((t) => {
          const entry = t.aircraft.find((a) => a.icao24 === ac.icao24);
          return entry ? [entry.position.lat, entry.position.lon] as LatLngTuple : null;
        })
        .filter(Boolean) as LatLngTuple[];

      return {
        icao24: ac.icao24,
        callsign: ac.callsign,
        trail,
        currentPos: [ac.position.lat, ac.position.lon] as LatLngTuple,
        heading: ac.position.true_track,
        verdict: ac.verdict,
        selected: ac.icao24 === selectedAc?.icao24,
      };
    });
  }, [sorted, ticks, currentTick, selectedAc]);

  const ensembleHistory = useMemo(() => {
    if (!selectedAc) return [];
    return ticks
      .slice(0, currentTick + 1)
      .map((t) => t.aircraft.find((a) => a.icao24 === selectedAc.icao24)?.ensemble_score.ratio ?? 0);
  }, [ticks, currentTick, selectedAc]);

  const counts = useMemo(() => {
    const c = { OK: 0, WARNING: 0, CRITICAL: 0 };
    for (const a of sorted) c[a.verdict] += 1;
    return c;
  }, [sorted]);

  if (!tick) return null;

  const domSub = selectedAc?.dominant_submodel ?? "iforest_v1";
  const subMeta = SUBMODEL_LABELS[domSub] ?? { name: domSub, desc: "", f1: 0 };
  const selVerdict = selectedAc?.verdict ?? "OK";
  const verdictClass = selVerdict === "CRITICAL"
    ? "text-red-500 border-red-500/40 bg-red-500/10"
    : selVerdict === "WARNING"
    ? "text-amber-400 border-amber-400/40 bg-amber-400/10"
    : "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">

      {/* ── LEFT COLUMN: map (fixed height) + aircraft table below ── */}
      <div className="flex flex-col flex-1 lg:w-0 border-r border-slate-800 min-h-0 overflow-hidden">

        {/* Map — fixed height */}
        <div className="flex-none h-[300px] border-b border-slate-800">
          <ReplayMapDynamic aircraft={aircraftTrails} onSelect={setSelectedIcao} />
        </div>

        {/* Fleet summary strip below map */}
        <div className="flex-none border-b border-slate-800 bg-slate-900/60 px-4 py-2 flex items-center gap-5 text-xs font-mono">
          <span className="text-[10px] tracking-wider uppercase text-slate-400">
            Tick #{tick.tick}
          </span>
          <span className="text-emerald-400">OK: {counts.OK}</span>
          <span className="text-amber-400">WARN: {counts.WARNING}</span>
          <span className="text-red-500">CRIT: {counts.CRITICAL}</span>
          <span className="ml-auto text-slate-500">{sorted.length} samolotów</span>
        </div>

        {/* Aircraft table — scrollable, fills remaining space */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full font-mono text-[11px]">
            <thead className="sticky top-0 bg-slate-900/95 border-b border-slate-800 z-10">
              <tr className="text-slate-500 tracking-wider uppercase text-[9px]">
                <th className="text-left px-3 py-2">Callsign</th>
                <th className="text-left px-2 py-2">Kraj</th>
                <th className="text-right px-2 py-2">Ratio</th>
                <th className="text-left px-2 py-2">Model</th>
                <th className="text-right px-3 py-2">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const ratio = a.ensemble_score.ratio;
                const txt = ratio >= 1.5 ? "text-red-500" : ratio >= 1.0 ? "text-amber-400" : "text-emerald-400";
                const isSelected = a.icao24 === selectedAc?.icao24;
                return (
                  <tr
                    key={a.icao24}
                    onClick={() => setSelectedIcao(a.icao24)}
                    className={`cursor-pointer border-b border-slate-900 hover:bg-slate-800/60 transition-colors ${isSelected ? "bg-slate-800/80 ring-inset ring-1 ring-indigo-500/30" : ""}`}
                  >
                    <td className="px-3 py-2 text-slate-100 font-semibold">{a.callsign}</td>
                    <td className="px-2 py-2 text-slate-500 truncate max-w-[90px]">{a.origin_country}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-semibold ${txt}`}>{ratio.toFixed(2)}×</td>
                    <td className="px-2 py-2 text-slate-500 text-[10px] uppercase">{a.dominant_submodel}</td>
                    <td className={`px-3 py-2 text-right text-[10px] uppercase tracking-wider ${txt}`}>{a.verdict}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── RIGHT COLUMN: scrollable analysis panel ── */}
      <aside className="flex flex-col flex-none lg:w-[380px] min-h-0 bg-slate-950 border-t lg:border-t-0 border-slate-800">
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 p-4">

          {/* Selected aircraft header */}
          {selectedAc && (
            <div className="border border-slate-800 bg-slate-900/60 rounded-sm p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono font-semibold">{selectedAc.callsign}</span>
                  <span className="text-[10px] ml-2 uppercase tracking-wider text-slate-500 font-mono">
                    {selectedAc.origin_country} · {selectedAc.icao24}
                  </span>
                </div>
                <VerdictPill verdict={selectedAc.verdict} />
              </div>
              <div className="font-mono text-[11px] tabular-nums text-slate-300">
                {fmtCoord(selectedAc.position.lat, selectedAc.position.lon)}
              </div>
              <div className="font-mono text-[11px] text-slate-500">
                FL{Math.round(selectedAc.position.alt / 30.48).toString().padStart(3, "0")} ·{" "}
                {selectedAc.position.velocity.toFixed(0)} kt · hdg {selectedAc.position.true_track.toFixed(0)}°
              </div>
            </div>
          )}

          {/* Dominant submodel badge — always rendered, fades when OK */}
          <div
            className={`border rounded-sm px-4 py-3 flex items-start gap-3 transition-opacity duration-200 ${verdictClass} ${selVerdict === "OK" ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            aria-hidden={selVerdict === "OK"}
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-[10px] tracking-wider uppercase opacity-70">Wykrył anomalię</span>
              <span className="font-mono font-semibold text-sm truncate">{subMeta.name}</span>
              <span className="font-mono text-[11px] opacity-80">{subMeta.desc}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-none text-right">
              <span className="text-[9px] tracking-wider uppercase opacity-60">F1</span>
              <span className="font-mono text-[11px]">{subMeta.f1.toFixed(3)}</span>
              <span className="font-mono text-[10px] opacity-60">{domSub}</span>
            </div>
          </div>

          {/* Ensemble score + sub-scores */}
          {selectedAc && (
            <>
              <ScoreBar
                label={`Ensemble — ${selectedAc.callsign}`}
                ratio={selectedAc.ensemble_score.ratio}
                threshold={selectedAc.ensemble_score.threshold}
                modelVersion="opensky-ensemble-v1"
                f1={0.935}
                history={ensembleHistory}
                layer="ENSEMBLE"
              />

              <div className="border border-slate-800 bg-slate-900/60 rounded-sm p-3 flex flex-col gap-2">
                <span className="text-[11px] tracking-wider uppercase text-slate-400 font-medium">
                  Ensemble breakdown
                </span>
                {(["iforest_v1", "iforest_v2"] as const).map((sub) => {
                  const isDom = domSub === sub;
                  return (
                    <div key={sub} className={`rounded-sm px-2 py-1 ${isDom ? "ring-1 ring-indigo-500/50 bg-indigo-500/5" : ""}`}>
                      <ScoreBar
                        thin
                        label={`${SUBMODEL_LABELS[sub]?.name ?? sub}${isDom ? " ← dominant" : ""}`}
                        ratio={selectedAc.sub_scores[sub].ratio}
                        threshold={1.0}
                        modelVersion={sub}
                      />
                    </div>
                  );
                })}
              </div>

              <TopReasons reasons={selectedAc.top_reasons} />
            </>
          )}

        </div>
      </aside>
    </div>
  );
}
