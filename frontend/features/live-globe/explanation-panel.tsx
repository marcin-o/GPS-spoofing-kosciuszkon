"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScoreBadge } from "@/components/score-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useExplain } from "@/lib/api/explain";
import type { Flight } from "@/lib/api/types";

export function ExplanationPanel({
  flight,
  open,
  onOpenChange,
}: {
  flight: Flight | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useExplain(flight?.icao24 ?? null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col gap-4 p-6"
      >
        <SheetHeader className="space-y-1 p-0">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="font-mono">
              {flight?.callsign ?? flight?.icao24 ?? "—"}
            </SheetTitle>
            {flight && (
              <ScoreBadge level={flight.alert_level} score={flight.spoofing_score} />
            )}
          </div>
          <SheetDescription className="text-xs font-mono text-muted-foreground">
            {flight ? `ICAO24 ${flight.icao24}` : ""}
          </SheetDescription>
        </SheetHeader>

        {flight && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Stat label="Position">
              {flight.lat.toFixed(2)}, {flight.lon.toFixed(2)}
            </Stat>
            <Stat label="Altitude">
              {flight.alt_m != null ? `${(flight.alt_m / 1000).toFixed(1)} km` : "—"}
            </Stat>
            <Stat label="Velocity">
              {flight.vel_kt != null ? `${flight.vel_kt} kt` : "—"}
            </Stat>
            <Stat label="Heading">
              {flight.heading != null ? `${flight.heading}°` : "—"}
            </Stat>
            <Stat label="NIC">{flight.nic ?? "—"}</Stat>
            <Stat label="Score">{(flight.spoofing_score * 100).toFixed(0)}%</Stat>
          </dl>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Why this alert
          </h3>
          {isLoading || !data ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : (
            <p className="text-sm text-foreground/90 leading-relaxed">
              {data.plain_english}
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            SHAP top-5
          </h3>
          {isLoading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : (
            <ShapBars features={data.top_features} />
          )}
        </section>

        {flight?.reasons.length ? (
          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Triggers
            </h3>
            <ul className="text-sm text-foreground/85 space-y-1 list-disc pl-5">
              {flight.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono text-sm">{children}</dd>
    </div>
  );
}

function ShapBars({
  features,
}: {
  features: { feature: string; contribution: number }[];
}) {
  const maxAbs = Math.max(...features.map((f) => Math.abs(f.contribution)), 0.01);
  return (
    <ul className="space-y-1.5">
      {features.map((f) => {
        const pct = (Math.abs(f.contribution) / maxAbs) * 100;
        const positive = f.contribution >= 0;
        return (
          <li
            key={f.feature}
            className="grid grid-cols-[1fr_auto] items-center gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span>{f.feature}</span>
                <span
                  className={
                    positive ? "text-red-400" : "text-emerald-400"
                  }
                >
                  {f.contribution >= 0 ? "+" : ""}
                  {f.contribution.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={
                    positive ? "h-full bg-red-400/80" : "h-full bg-emerald-400/80"
                  }
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
