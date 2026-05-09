"use client";

import { Button } from "@/components/ui/button";
import type { CameraPosition } from "@/lib/mapbox";

const POSITIONS: { key: CameraPosition; label: string; hotkey: string }[] = [
  { key: "globe", label: "Globe", hotkey: "1" },
  { key: "middleEast", label: "Middle East", hotkey: "2" },
  { key: "grozny", label: "Grozny", hotkey: "3" },
  { key: "hormuz", label: "Hormuz", hotkey: "4" },
  { key: "beirut", label: "Beirut", hotkey: "5" },
];

export function CameraDeck({
  onFlyTo,
}: {
  onFlyTo: (name: CameraPosition) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-background/85 backdrop-blur p-1">
      {POSITIONS.map((p) => (
        <Button
          key={p.key}
          size="sm"
          variant="ghost"
          className="h-7 px-2.5 text-xs"
          onClick={() => onFlyTo(p.key)}
        >
          <kbd className="font-mono text-[10px] text-muted-foreground border border-border/60 rounded px-1 mr-1.5">
            {p.hotkey}
          </kbd>
          {p.label}
        </Button>
      ))}
    </div>
  );
}

export const CAMERA_HOTKEYS: Record<string, CameraPosition> = {
  "1": "globe",
  "2": "middleEast",
  "3": "grozny",
  "4": "hormuz",
  "5": "beirut",
};
