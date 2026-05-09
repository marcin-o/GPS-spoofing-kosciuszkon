"use client";

import type { HealthResponse } from "@/lib/types";

interface ModelFooterProps {
  health: HealthResponse | null;
  mockMode: boolean;
}

export function ModelFooter({ health, mockMode }: ModelFooterProps) {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/95 px-4 py-1.5 flex items-center gap-4 text-[10px] font-mono tracking-wider uppercase text-slate-500 overflow-x-auto">
      <span>MODELS</span>
      {mockMode ? (
        <span className="text-amber-400">no backend — running on client mock</span>
      ) : health ? (
        <>
          {health.model_versions.map((m) => (
            <span key={m.version} className="text-slate-400 whitespace-nowrap">
              {m.layer}: <span className="text-slate-300">{m.version}</span>{" "}
              <span className="text-slate-600">F1={m.f1.toFixed(3)}</span>
            </span>
          ))}
        </>
      ) : (
        <span>connecting…</span>
      )}
      <span className="ml-auto text-slate-600 whitespace-nowrap">
        BUILD GNSS-DEFENSE-MONITOR-0.2.0 · KOŚCIUSZKON 2026
      </span>
    </footer>
  );
}
