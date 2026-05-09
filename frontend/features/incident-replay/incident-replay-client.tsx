"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/score-badge";
import { AudioPlayer } from "@/components/audio-player";
import { useIncidents, useIncidentReplay } from "@/lib/api/incidents";
import { alertSpeakUrl } from "@/lib/api/alerts";
import { TimeSlider } from "./time-slider";
import { ReplayMap } from "./replay-map";
import { ScoreSparkline } from "./score-sparkline";
import { cn } from "@/lib/utils";
import type { AlertLevel, IncidentSummary } from "@/lib/api/types";

export default function IncidentReplayClient() {
  const { data: incidents, isLoading } = useIncidents();
  const [picked, setPicked] = useState<string | null>(null);

  const selectedId = picked ?? incidents?.[0]?.id ?? null;

  return (
    <div className="flex-1 grid grid-rows-[auto_1fr] gap-4 p-6 min-h-0">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Incident Replay</h1>
        <div className="ml-auto flex items-center gap-2">
          <AudioPlayer
            src={selectedId ? alertSpeakUrl(selectedId) : null}
            label="Cockpit alert"
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 min-h-0">
        <IncidentList
          incidents={incidents ?? []}
          loading={isLoading}
          selectedId={selectedId}
          onPick={setPicked}
        />
        <ReplayPanel key={selectedId ?? "none"} incidentId={selectedId} />
      </div>
    </div>
  );
}

function IncidentList({
  incidents,
  loading,
  selectedId,
  onPick,
}: {
  incidents: IncidentSummary[];
  loading: boolean;
  selectedId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <aside className="space-y-2">
      {loading && (
        <>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </>
      )}
      {incidents.map((inc) => (
        <Button
          key={inc.id}
          variant="ghost"
          className={cn(
            "h-auto w-full justify-start whitespace-normal text-left p-3",
            inc.id === selectedId && "bg-secondary",
          )}
          onClick={() => onPick(inc.id)}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-sm font-semibold truncate">{inc.title}</span>
            <span className="text-xs text-muted-foreground">
              {inc.date} · {inc.region}
            </span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {inc.type}
            </span>
          </div>
        </Button>
      ))}
    </aside>
  );
}

function ReplayPanel({ incidentId }: { incidentId: string | null }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const { data: replay } = useIncidentReplay(incidentId);

  const currentFrame = replay?.frames[frameIndex];
  const level: AlertLevel = !currentFrame
    ? "ok"
    : currentFrame.score >= 0.7
      ? "critical"
      : currentFrame.score >= 0.4
        ? "warn"
        : "ok";

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <Card className="min-h-0 flex flex-col flex-1">
        <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm font-medium">
            {replay?.title ?? "Select an incident"}
          </CardTitle>
          {currentFrame && (
            <ScoreBadge level={level} score={currentFrame.score} />
          )}
        </CardHeader>
        <CardContent className="flex-1 min-h-0 p-0">
          <ReplayMap replay={replay ?? null} frameIndex={frameIndex} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          {replay && replay.frames.length > 0 ? (
            <>
              <ScoreSparkline replay={replay} frameIndex={frameIndex} />
              <TimeSlider
                total={replay.frames.length}
                frameIndex={frameIndex}
                onChange={setFrameIndex}
              />
            </>
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
