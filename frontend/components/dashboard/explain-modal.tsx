"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

interface ExplainModalProps {
  open: boolean;
  onClose: () => void;
  tickId: string;
}

interface ExplainPending {
  status: string;
  tick_id: string;
  message: string;
  placeholder_features: Array<{ feature: string; value: number | null; contribution: number | null }>;
  model_versions: string[];
}

export function ExplainModal({ open, onClose, tickId }: ExplainModalProps) {
  const [data, setData] = useState<ExplainPending | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(null);
    setError(null);
    fetch(`${API_BASE}/api/explain/${encodeURIComponent(tickId)}`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [open, tickId]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-950 border border-slate-800 rounded-sm w-full max-w-lg p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <h3 className="font-semibold text-sm tracking-wider uppercase text-slate-200">
              Per-tick explanation
            </h3>
            <p className="font-mono text-[10px] text-slate-500 mt-1">tick: {tickId}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}
        {data && (
          <>
            <div className="border border-amber-500/40 bg-amber-500/10 text-amber-300 px-3 py-2 rounded-sm text-xs">
              <strong className="font-mono uppercase tracking-wider mr-2">PENDING</strong>
              {data.message}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] tracking-wider uppercase text-slate-500">
                Placeholder features
              </span>
              <ul className="font-mono text-xs flex flex-col gap-0.5">
                {data.placeholder_features.map((f) => (
                  <li
                    key={f.feature}
                    className="flex justify-between border-b border-slate-900 py-1 text-slate-400"
                  >
                    <span>{f.feature}</span>
                    <span className="text-slate-600">— pending —</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-[10px] tracking-wider uppercase text-slate-500 mt-2">
              Models: {data.model_versions.join(" · ")}
            </div>
          </>
        )}
        {!data && !error && (
          <p className="text-slate-500 text-xs font-mono">loading…</p>
        )}
      </div>
    </div>
  );
}
