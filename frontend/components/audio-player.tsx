"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

type AudioPlayerProps = {
  src: string | null;
  label?: string;
  className?: string;
};

const BIP_FREQ = 880;
const BIP_MS = 220;

export function AudioPlayer({
  src,
  label = "Cockpit alert",
  className,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playBip = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      ctxRef.current = new Ctor();
    }
    const ctx = ctxRef.current!;
    if (ctx.state === "suspended") await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = BIP_FREQ;
    osc.type = "sine";
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + BIP_MS / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + BIP_MS / 1000 + 0.02);
    await new Promise((r) => setTimeout(r, BIP_MS + 30));
  }, []);

  const play = useCallback(async () => {
    if (!src) return;
    setError(null);
    try {
      await playBip();
      const el = audioRef.current;
      if (!el) return;
      el.src = src;
      await el.play();
      setPlaying(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audio failed");
      setPlaying(false);
    }
  }, [src, playBip]);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setPlaying(false);
    el.addEventListener("ended", onEnded);
    return () => el.removeEventListener("ended", onEnded);
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-2.5 py-1.5",
        className,
      )}
    >
      <Volume2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      <span className="text-xs text-muted-foreground">{label}</span>
      <Button
        size="sm"
        variant={playing ? "secondary" : "default"}
        className="h-7 px-2"
        onClick={() => (playing ? stop() : play())}
        disabled={!src}
        aria-label={playing ? "Stop alert" : "Play alert"}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
      <audio ref={audioRef} preload="auto" hidden />
      {error && (
        <span className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
