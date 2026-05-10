"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import type { OnboardTick } from "@/lib/types";
import { fmtCoord } from "@/lib/format";
import { VerdictPill } from "@/components/shared/verdict-pill";

interface ExplainModalProps {
  tick: OnboardTick;
  onClose: () => void;
}

interface ShapFeature {
  feature: string;
  value: number;
  contribution: number;
}

interface ExplainResponse {
  status: string;
  tick_id: string;
  scenario_id: string;
  tick: number;
  dominant_layer: "L1" | "L2";
  model_version: string;
  model_versions: string[];
  predicted_proba: number;
  threshold: number;
  ratio: number;
  base_value: number;
  top_features: ShapFeature[];
  shap_summary: {
    sum_positive: number;
    sum_negative: number;
    n_features_total: number;
  };
}

/**
 * Per-tick explanation overlay. The tick is captured as a snapshot when
 * the user clicks Explain — the modal no longer re-fetches on every WS
 * tick. Most of what's useful (verdict, ratios, top reasons) we already
 * computed server-side; the SHAP TreeExplainer block is still a stub.
 */
export function ExplainModal({ tick, onClose }: ExplainModalProps) {
  const [shap, setShap] = useState<ExplainResponse | null>(null);
  const [shapErr, setShapErr] = useState<string | null>(null);
  const tickId = `${tick.scenario_id}-${tick.tick}`;

  useEffect(() => {
    setShap(null);
    setShapErr(null);
    fetch(`${API_BASE}/api/explain/${encodeURIComponent(tickId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ExplainResponse>;
      })
      .then(setShap)
      .catch((e) => setShapErr(String(e?.message ?? e)));
  }, [tickId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-950 border border-slate-800 rounded-sm w-full max-w-xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="font-semibold text-sm tracking-wider uppercase text-slate-200">
              Migawka ticku
            </h3>
            <p className="font-mono text-[10px] text-slate-500 mt-1">
              {tick.callsign} · {tick.scenario_id} · #{tick.tick}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Verdict + dominant layer */}
        <div className="flex items-center gap-3 border border-slate-800 rounded-sm bg-slate-900/40 px-3 py-2">
          <VerdictPill verdict={tick.verdict} size="md" pulse={false} />
          <span className="text-[10px] tracking-wider uppercase text-slate-500">
            dominująca
          </span>
          <span className="font-mono text-sm text-slate-200">{tick.dominant_layer}</span>
          <span className="ml-auto font-mono text-[10px] text-slate-500">
            {tick.is_attack ? "FLAGA ATAKU: TAK" : "FLAGA ATAKU: nie"}
          </span>
        </div>

        {/* Per-layer scores */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <ScoreCell label="Warstwa L1 — TEXBAT" score={tick.scores.L1} />
          <ScoreCell label="Warstwa L2 — Aissou" score={tick.scores.L2} />
        </div>

        {/* Top reasons (already computed server-side) */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wider uppercase text-slate-500">
            Główne przyczyny
          </span>
          <ul className="text-xs flex flex-col gap-1">
            {tick.top_reasons.length === 0 && (
              <li className="text-slate-500 italic">— sygnał czysty —</li>
            )}
            {tick.top_reasons.map((r, i) => (
              <li key={i} className="text-slate-200 leading-relaxed">
                — {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Position context */}
        <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-400">
          <div>
            <div className="text-[9px] tracking-wider uppercase text-slate-500">Pozycja</div>
            <div>{fmtCoord(tick.position.lat, tick.position.lon)}</div>
          </div>
          <div>
            <div className="text-[9px] tracking-wider uppercase text-slate-500">Wysokość</div>
            <div>{(tick.position.alt / 1000).toFixed(1)}k m</div>
          </div>
          <div>
            <div className="text-[9px] tracking-wider uppercase text-slate-500">Kurs</div>
            <div>{tick.position.heading.toFixed(0)}°</div>
          </div>
        </div>

        {/* SHAP feature attribution */}
        <div className="border-t border-slate-800 pt-3 mt-1">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] tracking-wider uppercase text-emerald-400/80">
              SHAP — {shap?.dominant_layer ?? "…"} TreeExplainer
            </span>
            <span className="font-mono text-[9px] text-slate-500">
              {shap?.model_version ?? "ładowanie…"}
            </span>
          </div>

          {shapErr && (
            <div className="text-[11px] text-red-400 italic">
              SHAP niedostępny: {shapErr}
            </div>
          )}
          {!shapErr && !shap && (
            <div className="text-[11px] text-slate-500 italic">
              Liczenie wartości SHAP…
            </div>
          )}
          {shap && shap.top_features.length > 0 && (
            <ShapBars features={shap.top_features} />
          )}
          {shap && (
            <div className="text-[10px] text-slate-500 mt-2 font-mono">
              base log-odds {fmt(shap.base_value)} · proba {shap.predicted_proba.toFixed(3)} (próg {shap.threshold.toFixed(3)} → ratio {shap.ratio.toFixed(2)}×)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShapBars({ features }: { features: ShapFeature[] }) {
  const max = Math.max(...features.map((f) => Math.abs(f.contribution)), 1e-9);
  return (
    <ul className="flex flex-col gap-1">
      {features.map((f) => {
        const pct = (Math.abs(f.contribution) / max) * 100;
        const positive = f.contribution > 0;
        return (
          <li key={f.feature} className="flex items-center gap-2 text-[11px] font-mono">
            <span className="w-44 truncate text-slate-300" title={f.feature}>
              {f.feature}
            </span>
            <span className="w-16 tabular-nums text-right text-slate-500">
              {fmt(f.value)}
            </span>
            <div className="flex-1 h-3 bg-slate-900/60 rounded-sm relative overflow-hidden">
              <div
                className={`absolute top-0 bottom-0 ${positive ? "bg-red-500/70 left-1/2" : "bg-emerald-500/70 right-1/2"}`}
                style={{ width: `${pct / 2}%` }}
              />
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-700" />
            </div>
            <span className={`w-14 tabular-nums text-right ${positive ? "text-red-400" : "text-emerald-400"}`}>
              {f.contribution >= 0 ? "+" : ""}{f.contribution.toFixed(3)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(3);
}

function ScoreCell({
  label,
  score,
}: {
  label: string;
  score: { ratio: number; threshold: number; raw: number; model_version: string };
}) {
  const txt =
    score.ratio >= 1.5 ? "text-red-500"
      : score.ratio >= 1.0 ? "text-amber-400"
      : "text-emerald-400";
  return (
    <div className="border border-slate-800 rounded-sm bg-slate-900/40 px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[10px] tracking-wider uppercase text-slate-500">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono tabular-nums text-base font-semibold ${txt}`}>
          {score.ratio.toFixed(2)}×
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          (proba {score.raw.toFixed(3)} / próg {score.threshold.toFixed(2)})
        </span>
      </div>
      <span className="font-mono text-[9px] text-slate-600 tracking-wider uppercase">
        {score.model_version}
      </span>
    </div>
  );
}
