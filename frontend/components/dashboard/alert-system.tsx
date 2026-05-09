"use client";

import { AlertTriangle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/types";

export interface AlertEvent {
  id: string;
  ts: number;
  verdict: Verdict;
  context: "onboard" | "live_globe";
  callsign: string;
  layer: string;
  ratio: number;
  reason: string;
}

interface AlertSystemProps {
  events: AlertEvent[];
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const TOAST_DURATION_MS = 4500;
const BANNER_DURATION_MS = 6000;

export function AlertSystem({ events, soundEnabled, onToggleSound }: AlertSystemProps) {
  const [activeToasts, setActiveToasts] = useState<AlertEvent[]>([]);
  const [bannerEvent, setBannerEvent] = useState<AlertEvent | null>(null);
  const [flash, setFlash] = useState(false);

  const seenRef = useRef(new Set<string>());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lazy-init audio context (must be triggered by user interaction once).
  const beep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;
      const beepTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.18, now + start + 0.01);
        gain.gain.linearRampToValueAtTime(0, now + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      };
      beepTone(880, 0, 0.12);
      beepTone(660, 0.16, 0.18);
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  useEffect(() => {
    for (const ev of events) {
      if (seenRef.current.has(ev.id)) continue;
      seenRef.current.add(ev.id);

      // Toast for WARNING + CRITICAL.
      setActiveToasts((cur) => [...cur, ev].slice(-4));
      setTimeout(() => {
        setActiveToasts((cur) => cur.filter((t) => t.id !== ev.id));
      }, TOAST_DURATION_MS);

      if (ev.verdict === "CRITICAL") {
        setBannerEvent(ev);
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setBannerEvent(null), BANNER_DURATION_MS);

        setFlash(true);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlash(false), 500);

        beep();
      }
    }
  }, [events, beep]);

  return (
    <>
      {flash && (
        <div className="fixed inset-0 bg-[#EE3124]/35 pointer-events-none z-[60] animate-pulse" />
      )}

      {bannerEvent && (
        <div className="fixed top-14 left-0 right-0 z-50 animate-[slideDown_180ms_ease-out]">
          <div className="bg-[#EE3124] text-white border-b-2 border-red-700 px-6 py-3 flex items-center gap-4 shadow-2xl">
            <AlertTriangle className="h-6 w-6 flex-none animate-pulse" />
            <div className="flex flex-col leading-tight">
              <span className="font-semibold tracking-wider uppercase text-sm">
                Spoofing detected — {bannerEvent.layer} — {bannerEvent.callsign}
              </span>
              <span className="font-mono text-xs opacity-95">
                ratio {bannerEvent.ratio.toFixed(2)}× · {bannerEvent.reason}
              </span>
            </div>
            <button
              onClick={() => setBannerEvent(null)}
              className="ml-auto text-white/80 hover:text-white"
              aria-label="Dismiss banner"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="fixed top-20 right-4 z-40 flex flex-col gap-2 max-w-sm">
        {activeToasts.map((t) => (
          <Toast key={t.id} ev={t} onClose={() => setActiveToasts((cur) => cur.filter((x) => x.id !== t.id))} />
        ))}
      </div>

      <button
        onClick={onToggleSound}
        className={cn(
          "fixed bottom-9 right-3 z-30 border border-slate-800 px-2 py-1 rounded-sm text-[10px] tracking-wider uppercase font-mono transition-colors",
          soundEnabled ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" : "bg-slate-900/60 text-slate-400 hover:text-slate-200",
        )}
        title="Toggle CRITICAL beep"
      >
        sound: {soundEnabled ? "on" : "off"}
      </button>
    </>
  );
}

function Toast({ ev, onClose }: { ev: AlertEvent; onClose: () => void }) {
  const styling =
    ev.verdict === "CRITICAL"
      ? "border-red-500/60 bg-red-500/15 text-red-100"
      : ev.verdict === "WARNING"
        ? "border-amber-500/60 bg-amber-500/15 text-amber-100"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  return (
    <div
      className={cn(
        "border rounded-sm px-3 py-2 backdrop-blur-md shadow-lg flex items-start gap-2 animate-[slideInRight_180ms_ease-out]",
        styling,
      )}
    >
      <AlertTriangle className="h-4 w-4 flex-none mt-0.5" />
      <div className="flex-1">
        <div className="text-[10px] tracking-wider uppercase font-mono opacity-80">
          {ev.verdict} · {ev.layer} · {ev.callsign}
        </div>
        <div className="text-xs leading-snug mt-0.5">{ev.reason}</div>
        <div className="font-mono text-[10px] mt-1 opacity-70">
          ratio {ev.ratio.toFixed(2)}× · {new Date(ev.ts).toLocaleTimeString()}
        </div>
      </div>
      <button onClick={onClose} className="opacity-60 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
