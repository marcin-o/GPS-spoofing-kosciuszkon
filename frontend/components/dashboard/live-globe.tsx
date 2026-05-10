"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { AircraftEntry, GlobeTick } from "@/lib/types";
import { fmtAge, fmtCoord } from "@/lib/format";
import { ScoreBar } from "./score-bar";
import { VerdictPill } from "@/components/shared/verdict-pill";
import { TopReasons } from "./top-reasons";
import { useHealth } from "@/lib/use-health";

const GlobeMap = dynamic(() => import("./globe-map"), { ssr: false });

interface LiveGlobeProps {
  tick: GlobeTick | null;
  history: GlobeTick[];
  scenarioName: string;
}

export function LiveGlobe({ tick, history, scenarioName }: LiveGlobeProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const { f1 } = useHealth();

  const aircraft = tick?.aircraft ?? [];
  const sorted = useMemo(() => {
    return [...aircraft].sort((a, b) => b.ensemble_score.ratio - a.ensemble_score.ratio);
  }, [aircraft]);

  const selectedAc = useMemo(
    () => sorted.find((a) => a.icao24 === selected) ?? sorted[0] ?? null,
    [sorted, selected],
  );

  const ratioHistory = useMemo(() => {
    if (!selectedAc) return [];
    return history
      .map((h) => h.aircraft.find((a) => a.icao24 === selectedAc.icao24))
      .filter(Boolean)
      .map((a) => a!.ensemble_score.ratio);
  }, [history, selectedAc]);

  const counts = useMemo(() => {
    const c = { OK: 0, WARNING: 0, CRITICAL: 0 };
    for (const a of sorted) c[a.verdict] += 1;
    return c;
  }, [sorted]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 p-4 flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col gap-4 min-h-0">
        <div className="flex flex-wrap items-center gap-3 border border-slate-800 bg-slate-900/60 rounded-sm px-3 py-2">
          <span className="text-[11px] tracking-wider uppercase text-slate-400">{scenarioName}</span>
          <span className="ml-2 font-mono text-[10px] text-slate-500">tick #{tick?.tick ?? "—"}</span>
          <span className="ml-auto flex items-center gap-3 font-mono text-xs">
            <span className="text-emerald-400">OK {counts.OK}</span>
            <span className="text-amber-400">WARN {counts.WARNING}</span>
            <span className="text-red-500">CRIT {counts.CRITICAL}</span>
          </span>
        </div>

        <div className="border border-slate-800 rounded-sm overflow-hidden flex-1 min-h-[300px]">
          <GlobeMap
            aircraft={sorted}
            selected={selectedAc?.icao24 ?? null}
            onSelect={setSelected}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
          <ScoreBar
            label={selectedAc ? `Ensemble — ${selectedAc.callsign}` : "Ensemble"}
            ratio={selectedAc?.ensemble_score.ratio ?? 0}
            threshold={selectedAc?.ensemble_score.threshold ?? 1.0}
            modelVersion="opensky-ensemble-v1"
            f1={f1.L3}
            history={ratioHistory}
            layer="ENSEMBLE"
          />
          <div className="border border-slate-800 bg-slate-900/60 rounded-sm p-3 flex flex-col gap-2">
            <span className="text-[11px] tracking-wider uppercase text-slate-400 font-medium">
              Ensemble breakdown
            </span>
            {selectedAc ? (
              <div className="flex flex-col gap-2">
                <ScoreBar thin label="iforest-v1" ratio={selectedAc.sub_scores.iforest_v1.ratio} threshold={1.0} modelVersion="opensky-iforest-v1" />
                <ScoreBar thin label="iforest-v2 (multitime)" ratio={selectedAc.sub_scores.iforest_v2.ratio} threshold={1.0} modelVersion="opensky-iforest-v2-multitime" />
              </div>
            ) : (
              <span className="text-slate-500 text-xs">no aircraft selected</span>
            )}
          </div>
        </div>
      </div>

      <aside className="flex flex-col gap-3 min-h-0">
        {selectedAc && (
          <div className="border border-slate-800 bg-slate-900/60 rounded-sm p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-mono font-semibold text-sm">{selectedAc.callsign}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                  {selectedAc.origin_country} · {selectedAc.icao24}
                </span>
              </div>
              <VerdictPill verdict={selectedAc.verdict} />
            </div>
            <div className="font-mono text-[11px] tabular-nums text-slate-300">
              {fmtCoord(selectedAc.position.lat, selectedAc.position.lon)}
            </div>
            <div className="font-mono text-[11px] text-slate-500">
              FL{Math.round(selectedAc.position.alt / 30.48).toString().padStart(3, "0")} · {selectedAc.position.velocity.toFixed(0)} kt · hdg {selectedAc.position.true_track.toFixed(0)}°
            </div>
            <TopReasons reasons={selectedAc.top_reasons} />
          </div>
        )}

        <div className="border border-slate-800 bg-slate-900/40 rounded-sm overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] tracking-wider uppercase text-slate-400 font-medium">
              Aircraft list
            </span>
            <span className="ml-auto font-mono text-[10px] text-slate-500">{sorted.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full font-mono text-[11px]">
              <thead className="sticky top-0 bg-slate-900/95 border-b border-slate-800">
                <tr className="text-slate-500 tracking-wider uppercase text-[9px]">
                  <th className="text-left px-2 py-1.5">Callsign</th>
                  <th className="text-left px-2 py-1.5">Country</th>
                  <th className="text-right px-2 py-1.5">Ratio</th>
                  <th className="text-left px-2 py-1.5">Sub</th>
                  <th className="text-right px-2 py-1.5">Age</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 50).map((a) => (
                  <RowFor key={a.icao24} a={a} selected={a.icao24 === selectedAc?.icao24} onClick={() => setSelected(a.icao24)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </div>
  );
}

function RowFor({ a, selected, onClick }: { a: AircraftEntry; selected: boolean; onClick: () => void }) {
  const ratio = a.ensemble_score.ratio;
  const txt = ratio >= 1.5 ? "text-red-500" : ratio >= 1.0 ? "text-amber-400" : "text-emerald-400";
  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-b border-slate-900 hover:bg-slate-900/70 ${selected ? "bg-slate-900/80" : ""}`}
    >
      <td className="px-2 py-1.5 text-slate-200">{a.callsign}</td>
      <td className="px-2 py-1.5 text-slate-500 truncate max-w-[120px]">{a.origin_country}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums ${txt}`}>{ratio.toFixed(2)}×</td>
      <td className="px-2 py-1.5 text-slate-500 text-[10px] uppercase">{a.dominant_submodel}</td>
      <td className="px-2 py-1.5 text-right text-slate-500">{fmtAge(Date.now(), a.last_contact)}</td>
    </tr>
  );
}
