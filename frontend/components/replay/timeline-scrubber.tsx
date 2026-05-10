"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Pause, Play, Plane, RotateCcw, Shield, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IncidentAnnotation, Verdict } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TimelineScrubberProps {
  currentTick: number;
  totalTicks: number;
  playing: boolean;
  speed: number;
  durationSec: number;
  verdicts: Verdict[];
  attackTick: number | null;
  annotations?: IncidentAnnotation[];
  onSetTick: (t: number) => void;
  onTogglePlay: () => void;
  onStep: (delta: number) => void;
  onReset: () => void;
  onSpeedChange: (s: number) => void;
}

const ANNOTATION_ICON = {
  alert: AlertTriangle,
  check: CheckCircle2,
  shield: Shield,
  plane: Plane,
} as const;

const VERDICT_COLOR: Record<Verdict, string> = {
  OK: "#34d399",
  WARNING: "#fbbf24",
  CRITICAL: "#ef4444",
};

const SPEEDS = [0.25, 0.5, 1, 2, 4];

export function TimelineScrubber({
  currentTick,
  totalTicks,
  playing,
  speed,
  durationSec,
  verdicts,
  attackTick,
  annotations,
  onSetTick,
  onTogglePlay,
  onStep,
  onReset,
  onSpeedChange,
}: TimelineScrubberProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw verdict heatmap on canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const n = verdicts.length;
    if (n === 0) return;
    const barW = w / n;

    verdicts.forEach((v, i) => {
      ctx.fillStyle = VERDICT_COLOR[v];
      ctx.globalAlpha = v === "OK" ? 0.25 : 0.7;
      ctx.fillRect(i * barW, 0, Math.max(1, barW), h);
    });

    // Attack onset marker.
    if (attackTick !== null && attackTick < n) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      const x = (attackTick / n) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Current tick cursor.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    const curX = ((currentTick + 0.5) / n) * w;
    ctx.beginPath();
    ctx.moveTo(curX, 0);
    ctx.lineTo(curX, h);
    ctx.stroke();
  }, [verdicts, currentTick, attackTick]);

  // Keyboard handlers.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") { e.preventDefault(); onStep(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); onStep(1); }
      else if (e.key === " ") { e.preventDefault(); onTogglePlay(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStep, onTogglePlay]);

  const elapsed = (currentTick * durationSec) / Math.max(1, totalTicks - 1);

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  return (
    <div className="border-b border-slate-800 bg-slate-950/95 px-4 py-2 flex flex-col gap-2 select-none">
      {/* Annotation row above the heatmap */}
      {annotations && annotations.length > 0 && (
        <div className="relative h-5">
          {annotations.map((a, i) => {
            const Icon = ANNOTATION_ICON[a.icon ?? "alert"];
            const left = `${((a.tick / Math.max(1, totalTicks - 1)) * 100).toFixed(2)}%`;
            const passed = currentTick >= a.tick;
            return (
              <Tooltip key={i}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => onSetTick(a.tick)}
                      style={{ left }}
                      className={cn(
                        "absolute -translate-x-1/2 top-0 flex items-center justify-center h-5 w-5 rounded-full border transition-all",
                        passed
                          ? "border-[#EE3124]/60 bg-[#EE3124]/15 text-[#EE3124]"
                          : "border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-500",
                      )}
                      aria-label={`Annotation: ${a.label}`}
                    />
                  }
                />
                <TooltipContent>
                  <span className="font-mono text-[10px] uppercase tracking-wider">T+{a.tick} · {a.label}</span>
                </TooltipContent>
                <Icon className="h-3 w-3 pointer-events-none absolute" style={{ left, transform: "translateX(-50%) translateY(2px)" }} />
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Heatmap */}
      <div className="relative h-6 rounded-sm overflow-hidden bg-slate-900 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          onSetTick(Math.round(ratio * (totalTicks - 1)));
        }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={24}
          className="w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
        {attackTick !== null && (
          <div
            className="absolute top-0 h-full flex items-center"
            style={{ left: `${((attackTick / totalTicks) * 100).toFixed(1)}%`, pointerEvents: "none" }}
          >
            <span className="bg-orange-500/80 text-white text-[8px] font-mono px-1 py-0.5 rounded-sm tracking-wider uppercase">
              ATAK
            </span>
          </div>
        )}
      </div>

      {/* Range slider */}
      <input
        type="range"
        min={0}
        max={totalTicks - 1}
        value={currentTick}
        onChange={(e) => onSetTick(Number(e.target.value))}
        className="w-full h-1 accent-indigo-500 cursor-pointer"
      />

      {/* Controls row */}
      <div className="flex items-center gap-3">
        <button
          onClick={onReset}
          className="text-slate-400 hover:text-white transition-colors"
          title="Reset (R)"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={() => onStep(-1)}
          className="text-slate-400 hover:text-white transition-colors"
          title="Poprzedni tick (←)"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          onClick={onTogglePlay}
          className={cn(
            "flex items-center justify-center h-7 w-7 rounded-full transition-colors",
            playing
              ? "bg-indigo-500 hover:bg-indigo-400 text-white"
              : "bg-slate-700 hover:bg-slate-600 text-white",
          )}
          title="Play/Pause (Space)"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => onStep(1)}
          className="text-slate-400 hover:text-white transition-colors"
          title="Następny tick (→)"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-1.5 ml-1">
          <span className="text-[10px] tracking-wider uppercase text-slate-500">Speed</span>
          <select
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 text-xs font-mono px-1.5 py-0.5 rounded-sm focus:outline-none focus:border-indigo-500/60"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>{s}×</option>
            ))}
          </select>
        </div>

        {/* Time readout */}
        <div className="ml-auto font-mono text-xs tabular-nums text-slate-300">
          <span className="text-indigo-400">{fmt(elapsed)}</span>
          <span className="text-slate-600"> / {fmt(durationSec)}</span>
          <span className="text-slate-500 ml-2">#{currentTick + 1}/{totalTicks}</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
          {(["OK", "WARNING", "CRITICAL"] as const).map((v) => (
            <span key={v} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm inline-block" style={{ background: VERDICT_COLOR[v] }} />
              {v}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 inline-block border-l-2 border-orange-500 border-dashed" />
            Atak
          </span>
        </div>
      </div>

      {/* Keyboard hint */}
      <p className="text-[9px] text-slate-600 font-mono tracking-wider">
        ← / → — krok · SPACE — play/pause · kliknij na heatmapę — skok do ticku
      </p>
    </div>
  );
}
