"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadReplay } from "@/lib/replay-feed";
import type { GlobeTick, OnboardTick, ReplayBundle, Scenario } from "@/lib/types";
import { TimelineScrubber } from "./timeline-scrubber";
import { ReplayOnboard } from "./replay-onboard";
import { ReplayGlobe } from "./replay-globe";

interface ReplayViewProps {
  scenario: string;
  scenarioMeta: Scenario | null;
  mockMode: boolean;
}

const BASE_INTERVAL_MS: Record<"onboard" | "live_globe", number> = {
  onboard: 500,
  live_globe: 1500,
};

export function ReplayView({ scenario, scenarioMeta, mockMode }: ReplayViewProps) {
  const [bundle, setBundle] = useState<ReplayBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTick, setCurrentTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load bundle when scenario changes.
  useEffect(() => {
    setBundle(null);
    setCurrentTick(0);
    setPlaying(false);
    setError(null);
    setLoading(true);

    const scenMode = scenarioMeta?.mode ?? "onboard";
    loadReplay(scenario, scenMode as "onboard" | "live_globe", mockMode)
      .then((b) => {
        setBundle(b);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(String(e));
        setLoading(false);
      });
  }, [scenario, scenarioMeta?.mode, mockMode]);

  // Animator.
  useEffect(() => {
    if (animRef.current) clearInterval(animRef.current);
    animRef.current = null;

    if (!playing || !bundle) return;

    const n = bundle.ticks.length;
    const baseMs = BASE_INTERVAL_MS[bundle.mode] ?? 500;
    const ms = Math.max(50, baseMs / speed);

    animRef.current = setInterval(() => {
      setCurrentTick((prev) => {
        if (prev >= n - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, ms);

    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, [playing, speed, bundle]);

  const handleSetTick = useCallback((t: number) => {
    setCurrentTick(t);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && bundle && currentTick >= bundle.ticks.length - 1) {
        setCurrentTick(0);
      }
      return !p;
    });
  }, [bundle, currentTick]);

  const handleStep = useCallback((delta: number) => {
    if (!bundle) return;
    setCurrentTick((prev) => Math.max(0, Math.min(bundle.ticks.length - 1, prev + delta)));
  }, [bundle]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setCurrentTick(0);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-sm font-mono tracking-wider uppercase">
          Ładowanie danych scenariusza…
        </p>
        <p className="text-xs text-slate-600 font-mono">
          {scenarioMeta?.name ?? scenario}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400 font-mono text-sm">
        Błąd ładowania: {error}
      </div>
    );
  }

  if (!bundle) return null;

  const n = bundle.ticks.length;
  const tick = bundle.ticks[currentTick];
  const baseMs = BASE_INTERVAL_MS[bundle.mode] ?? 500;
  const durationSec = (n * baseMs) / 1000;

  // Compute verdicts timeline for heatmap.
  const verdicts = bundle.ticks.map((t) => {
    if (bundle.mode === "onboard") return (t as OnboardTick).verdict;
    const gt = t as GlobeTick;
    if (!gt.aircraft?.length) return "OK" as const;
    const worst = gt.aircraft.reduce<"OK" | "WARNING" | "CRITICAL">((acc, a) => {
      if (a.verdict === "CRITICAL") return "CRITICAL";
      if (a.verdict === "WARNING" && acc !== "CRITICAL") return "WARNING";
      return acc;
    }, "OK");
    return worst;
  });

  // Find first attack tick for the marker.
  let attackTick: number | null = null;
  if (bundle.mode === "onboard") {
    attackTick = (bundle.ticks as OnboardTick[]).findIndex((t) => t.is_attack);
    if (attackTick === -1) attackTick = null;
  } else {
    attackTick = (bundle.ticks as GlobeTick[]).findIndex((t) =>
      t.aircraft.some((a) => a.is_anomaly),
    );
    if (attackTick === -1) attackTick = null;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <TimelineScrubber
        currentTick={currentTick}
        totalTicks={n}
        playing={playing}
        speed={speed}
        durationSec={durationSec}
        verdicts={verdicts}
        attackTick={attackTick}
        onSetTick={handleSetTick}
        onTogglePlay={handleTogglePlay}
        onStep={handleStep}
        onReset={handleReset}
        onSpeedChange={setSpeed}
      />

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {bundle.mode === "onboard" ? (
          <ReplayOnboard
            ticks={bundle.ticks as OnboardTick[]}
            currentTick={currentTick}
          />
        ) : (
          <ReplayGlobe
            ticks={bundle.ticks as GlobeTick[]}
            currentTick={currentTick}
          />
        )}
      </div>
    </div>
  );
}
