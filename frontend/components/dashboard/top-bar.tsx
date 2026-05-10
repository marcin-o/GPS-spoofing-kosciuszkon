"use client";

import { Activity, Crosshair, Globe, History, Plane, Radar, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Mode, Scenario } from "@/lib/types";

interface TopBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  scenario: string;
  onScenarioChange: (id: string) => void;
  scenarios: Scenario[];
  inferenceMs: number | null;
  onInject: () => void;
  onExport: () => void;
  mockMode: boolean;
  injectFlash: boolean;
}

export function TopBar({
  mode,
  onModeChange,
  scenario,
  onScenarioChange,
  scenarios,
  inferenceMs,
  onInject,
  onExport,
  mockMode,
  injectFlash,
}: TopBarProps) {
  const filteredScenarios = mode === "replay" ? scenarios : scenarios.filter((s) => s.mode === mode);

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-4 px-4 h-14">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-[#EE3124]" aria-hidden />
          <div className="flex flex-col leading-none">
            <span className="font-semibold tracking-tight text-sm">GNSS DEFENSE MONITOR</span>
            <span className="font-mono text-[10px] text-slate-500 tracking-wider mt-0.5">
              KOŚCIUSZKON 2026 · HONEYWELL
            </span>
          </div>
        </div>

        <div className="ml-4 flex border border-slate-800 rounded-sm overflow-hidden text-xs font-medium">
          <button
            onClick={() => onModeChange("onboard")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 tracking-wider uppercase transition-colors",
              mode === "onboard"
                ? "bg-[#EE3124]/15 text-[#EE3124] border-r border-slate-800"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200 border-r border-slate-800",
            )}
          >
            <Plane className="h-3.5 w-3.5" /> Onboard Monitor
          </button>
          <button
            onClick={() => onModeChange("live_globe")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 tracking-wider uppercase transition-colors border-r border-slate-800",
              mode === "live_globe"
                ? "bg-[#EE3124]/15 text-[#EE3124]"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
            )}
          >
            <Globe className="h-3.5 w-3.5" /> Live Globe
          </button>
          <button
            onClick={() => onModeChange("replay")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 tracking-wider uppercase transition-colors",
              mode === "replay"
                ? "bg-indigo-500/15 text-indigo-400"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
            )}
          >
            <History className="h-3.5 w-3.5" /> Replay
          </button>
        </div>

        <div className="ml-2 flex items-center gap-2">
          <span className="text-[10px] tracking-wider uppercase text-slate-500">scenario</span>
          <select
            value={scenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs font-mono px-2 py-1 rounded-sm focus:outline-none focus:border-[#EE3124]/60 min-w-[220px]"
          >
            {filteredScenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {mockMode && (
            <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-sm text-[10px] tracking-wider uppercase font-mono">
              <Activity className="h-3 w-3 animate-pulse" /> Mock Mode — backend offline
            </div>
          )}

          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
            <Crosshair className={cn("h-3.5 w-3.5", inferenceMs == null ? "text-slate-600" : "text-emerald-400")} />
            <span className="tracking-wider uppercase text-[10px] text-slate-500">INFERENCE</span>
            <span className="tabular-nums text-slate-200" data-testid="inference-latency">
              {inferenceMs == null ? "—" : `${inferenceMs.toFixed(0)} ms`}
            </span>
          </div>

          {mode !== "replay" && (
            <button
              onClick={onInject}
              className={cn(
                "flex items-center gap-1.5 bg-[#EE3124] hover:bg-[#cc2820] text-white font-medium text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm transition-all",
                injectFlash && "ring-2 ring-[#EE3124] animate-pulse",
              )}
            >
              <Zap className="h-3.5 w-3.5" /> Inject Attack
            </button>
          )}

          <button
            onClick={onExport}
            className="text-xs uppercase tracking-wider text-slate-300 hover:text-white border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-sm transition-colors"
          >
            Export Report
          </button>
        </div>
      </div>
    </header>
  );
}
