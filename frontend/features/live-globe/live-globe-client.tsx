"use client";

import { useEffect, useMemo, useState } from "react";
import { useFlightsLive } from "@/lib/api/flights";
import { useGlobeMap } from "./use-globe-map";
import { ExplanationPanel } from "./explanation-panel";
import { setAircraftData } from "./layers/aircraft-layer";
import { HAS_MAPBOX_TOKEN } from "@/lib/mapbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/score-badge";
import type { Flight } from "@/lib/api/types";
import { CAMERA_HOTKEYS, CameraDeck } from "./camera-deck";

export default function LiveGlobeClient() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { containerRef, map, ready, bbox, flyTo } = useGlobeMap({
    onAircraftClick: setSelectedId,
  });

  const { data: flights, isLoading, error } = useFlightsLive(bbox);

  useEffect(() => {
    if (!ready || !map.current || !flights) return;
    setAircraftData(map.current, flights);
  }, [ready, flights, map]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable)
          return;
      }
      const target = CAMERA_HOTKEYS[e.key];
      if (target) flyTo(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flyTo]);

  const selectedFlight = useMemo(
    () => flights?.find((f) => f.icao24 === selectedId) ?? null,
    [flights, selectedId],
  );

  const counts = useMemo(() => countByLevel(flights ?? []), [flights]);

  if (!HAS_MAPBOX_TOKEN) {
    return <MissingTokenCard />;
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={containerRef}
        className="flex-1 w-full bg-slate-950"
        aria-label="Live globe"
      />

      <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-start justify-between gap-3">
        <Card className="pointer-events-auto bg-background/85 backdrop-blur border-border/60">
          <CardContent className="flex items-center gap-4 px-4 py-2.5">
            <Stat label="Aircraft" value={flights?.length ?? "—"} />
            <Divider />
            <Stat label="Critical" value={counts.critical} accent="critical" />
            <Stat label="Warn" value={counts.warn} accent="warn" />
            <Stat label="OK" value={counts.ok} accent="ok" />
          </CardContent>
        </Card>

        <Card className="pointer-events-auto bg-background/85 backdrop-blur border-border/60">
          <CardContent className="px-4 py-2.5 text-xs text-muted-foreground">
            {error
              ? "API offline · using last cached"
              : isLoading
                ? "Fetching live state..."
                : "Polling every 15s · OpenSky"}
          </CardContent>
        </Card>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
        <div className="pointer-events-auto">
          <CameraDeck onFlyTo={flyTo} />
        </div>
      </div>

      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <Skeleton className="h-8 w-48" />
        </div>
      )}

      <ExplanationPanel
        flight={selectedFlight}
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </div>
  );
}

function countByLevel(flights: Flight[]) {
  return flights.reduce(
    (acc, f) => {
      acc[f.alert_level]++;
      return acc;
    },
    { ok: 0, warn: 0, critical: 0 },
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "ok" | "warn" | "critical";
}) {
  const accentClass =
    accent === "critical"
      ? "text-red-400"
      : accent === "warn"
        ? "text-amber-400"
        : accent === "ok"
          ? "text-emerald-400"
          : "text-foreground";
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-sm font-semibold ${accentClass}`}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="h-6 w-px bg-border/60" aria-hidden />;
}

function MissingTokenCard() {
  return (
    <div className="flex-1 grid place-items-center p-6">
      <Card className="max-w-lg">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <ScoreBadge level="warn" score={0} />
            <h3 className="font-semibold">Mapbox token missing</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The 3D globe needs a Mapbox access token. Create a free one at{" "}
            <a
              className="underline underline-offset-2 hover:text-foreground"
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noreferrer"
            >
              account.mapbox.com
            </a>{" "}
            and put it in <code className="font-mono">.env.local</code> as{" "}
            <code className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code>, then restart{" "}
            <code className="font-mono">next dev</code>.
          </p>
          <p className="text-xs text-muted-foreground">
            Tip: URL-restrict the token to <code>localhost:3000</code> and your
            deploy domain before pushing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
