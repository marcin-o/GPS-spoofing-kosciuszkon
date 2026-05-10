"use client";

import { useEffect, useState } from "react";
import type { HealthResponse } from "@/lib/types";
import { getHealth } from "@/lib/api";

const F1_DEFAULTS = { L1: 0.984, L2: 0.976, L3: 0.935 } as const;

interface F1Lookup {
  L1: number;
  L2: number;
  L3: number;
}

function deriveF1(health: HealthResponse | null): F1Lookup {
  if (!health) return F1_DEFAULTS;
  const lookup: F1Lookup = { ...F1_DEFAULTS };
  for (const m of health.model_versions ?? []) {
    const layer = m.layer?.toUpperCase();
    if (layer === "L1" && Number.isFinite(m.f1)) lookup.L1 = m.f1;
    else if (layer === "L2" && Number.isFinite(m.f1)) lookup.L2 = m.f1;
    else if (layer === "L3" && Number.isFinite(m.f1)) lookup.L3 = m.f1;
  }
  return lookup;
}

let cached: HealthResponse | null = null;
const subscribers = new Set<(h: HealthResponse | null) => void>();

export function useHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(cached);

  useEffect(() => {
    if (cached) return;
    let active = true;
    getHealth().then((h) => {
      if (!active) return;
      cached = h;
      setHealth(h);
      subscribers.forEach((cb) => cb(h));
    });
    const cb = (h: HealthResponse | null) => setHealth(h);
    subscribers.add(cb);
    return () => {
      active = false;
      subscribers.delete(cb);
    };
  }, []);

  const f1 = deriveF1(health);
  return { health, f1 };
}
