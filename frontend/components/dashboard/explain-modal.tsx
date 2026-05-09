"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import type { OnboardTick } from "@/lib/types";
import { fmtCoord } from "@/lib/format";
import { VerdictPill } from "./verdict-pill";

interface ExplainModalProps {
  tick: OnboardTick;
  onClose: () => void;
}

interface ExplainPending {
  status: string;
  tick_id: string;
  message: string;
  placeholder_features: Array<{ feature: string; value: number | null; contribution: number | null }>;
  model_versions: string[];
}

/**
 * Per-tick explanation overlay. The tick is captured as a snapshot when
 * the user clicks Explain — the modal no longer re-fetches on every WS
 * tick. Most of what's useful (verdict, ratios, top reasons) we already
 * computed server-side; the SHAP TreeExplainer block is still a stub.
 */
export function ExplainModal({ tick, onClose }: ExplainModalProps) {
  const [shap, setShap] = useState<ExplainPending | null>(null);
  const tickId = `${tick.scenario_id}-${tick.tick}`;

  useEffect(() => {
    fetch(`${API_BASE}/api/explain/${encodeURIComponent(tickId)}`)
      .then((r) => r.json())
      .then(setShap)
      .catch(() => {/* ignore — SHAP is opt-in */});
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
              Tick snapshot
            </h3>
            <p className="font-mono text-[10px] text-slate-500 mt-1">
              {tick.callsign} · {tick.scenario_id} · #{tick.tick}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Verdict + dominant layer */}
        <div className="flex items-center gap-3 border border-slate-800 rounded-sm bg-slate-900/40 px-3 py-2">
          <VerdictPill verdict={tick.verdict} size="md" pulse={false} />
          <span className="text-[10px] tracking-wider uppercase text-slate-500">
            dominant
          </span>
          <span className="font-mono text-sm text-slate-200">{tick.dominant_layer}</span>
          <span className="ml-auto font-mono text-[10px] text-slate-500">
            {tick.is_attack ? "ATTACK FLAG: TRUE" : "ATTACK FLAG: false"}
          </span>
        </div>

        {/* Per-layer scores */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <ScoreCell label="Layer L1 — TEXBAT" score={tick.scores.L1} />
          <ScoreCell label="Layer L2 — Aissou" score={tick.scores.L2} />
        </div>

        {/* Top reasons (already computed server-side) */}
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wider uppercase text-slate-500">
            Top reasons
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
            <div className="text-[9px] tracking-wider uppercase text-slate-500">Position</div>
            <div>{fmtCoord(tick.position.lat, tick.position.lon)}</div>
          </div>
          <div>
            <div className="text-[9px] tracking-wider uppercase text-slate-500">Altitude</div>
            <div>{(tick.position.alt / 1000).toFixed(1)}k m</div>
          </div>
          <div>
            <div className="text-[9px] tracking-wider uppercase text-slate-500">Heading</div>
            <div>{tick.position.heading.toFixed(0)}°</div>
          </div>
        </div>

        {/* SHAP placeholder — collapsed footer instead of dominating the panel */}
        {shap && (
          <div className="border-t border-slate-800 pt-3 mt-1">
            <div className="text-[10px] tracking-wider uppercase text-amber-400/80 mb-1">
              SHAP feature attribution: <span className="font-mono">{shap.status}</span>
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              {shap.message}.{" "}
              <span className="text-slate-600">
                Per-feature contributions ({shap.placeholder_features.length}) — TreeExplainer integration in progress.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
          (raw {score.raw.toFixed(3)} / thr {score.threshold.toFixed(2)})
        </span>
      </div>
      <span className="font-mono text-[9px] text-slate-600 tracking-wider uppercase">
        {score.model_version}
      </span>
    </div>
  );
}
