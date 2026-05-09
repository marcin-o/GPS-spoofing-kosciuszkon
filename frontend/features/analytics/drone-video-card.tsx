"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const VIDEO_SRC = "/data/drone-replay.mp4";

export function DroneVideoCard() {
  const [hasVideo, setHasVideo] = useState(true);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-medium">
          Drone tier — PX4 GPS / IMU divergence
        </CardTitle>
        <Badge variant="outline" className="text-[10px] uppercase">
          Replay
        </Badge>
      </CardHeader>
      <CardContent>
        {hasVideo ? (
          <video
            controls
            preload="metadata"
            className="w-full rounded-md border border-border/60 bg-slate-950"
            src={VIDEO_SRC}
            onError={() => setHasVideo(false)}
          />
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-secondary/20 p-6 text-sm text-muted-foreground space-y-2">
            <p>
              <span className="font-medium text-foreground">Video pending.</span>{" "}
              Person C drops the PX4 GPS-IMU divergence demo at{" "}
              <code className="font-mono">public/data/drone-replay.mp4</code>.
            </p>
            <p>
              Until then, this card silently no-ops so the rest of the analytics
              tab keeps rendering for code review.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
