"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type TimeSliderProps = {
  total: number;
  frameIndex: number;
  onChange: (i: number) => void;
};

const SPEEDS = [1, 2, 4] as const;
const STEP_MS = 100;

export function TimeSlider({ total, frameIndex, onChange }: TimeSliderProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  const advanceOnce = useEffectEvent(() => {
    const next = frameIndex + 1;
    if (next >= total) {
      setPlaying(false);
      return;
    }
    onChange(next);
  });

  const lastTsRef = useRef<number>(0);
  const accRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      lastTsRef.current = 0;
      accRef.current = 0;
      return;
    }

    let raf = 0;
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      accRef.current += dt * speed;
      while (accRef.current >= STEP_MS) {
        accRef.current -= STEP_MS;
        advanceOnce();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const onPlay = () => {
    if (frameIndex >= total - 1) onChange(0);
    setPlaying(true);
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        size="icon"
        variant={playing ? "secondary" : "default"}
        className="h-8 w-8"
        onClick={() => (playing ? setPlaying(false) : onPlay())}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <div className="flex-1">
        <Slider
          value={[frameIndex]}
          min={0}
          max={Math.max(0, total - 1)}
          step={1}
          onValueChange={(v) =>
            onChange(Array.isArray(v) ? (v[0] ?? 0) : Number(v))
          }
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {frameIndex + 1} / {total}
      </span>
      <div className="flex gap-1">
        {SPEEDS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={s === speed ? "secondary" : "ghost"}
            className="h-7 px-2 font-mono text-xs"
            onClick={() => setSpeed(s)}
          >
            {s}×
          </Button>
        ))}
      </div>
    </div>
  );
}
