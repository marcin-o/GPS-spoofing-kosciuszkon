"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  FEATURES,
  PRESETS,
  PRESET_LABELS,
  type FeatureKey,
  type PresetKey,
} from "./presets";
import { useScoreOnboard } from "@/lib/api/onboard";
import { cn } from "@/lib/utils";
import { OnboardResult } from "./onboard-result";

const initialFeatures: Record<FeatureKey, number> = { ...PRESETS.clean };

export function OnboardForm() {
  const [features, setFeatures] = useState(initialFeatures);
  const [activePreset, setActivePreset] = useState<PresetKey | null>("clean");
  const score = useScoreOnboard();

  const setFeature = (k: FeatureKey, v: number) => {
    setFeatures((prev) => ({ ...prev, [k]: v }));
    setActivePreset(null);
  };

  const applyPreset = (p: PresetKey) => {
    setFeatures({ ...PRESETS[p] });
    setActivePreset(p);
  };

  const submit = () => score.mutate({ features });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 h-full min-h-0">
      <Card className="min-h-0 flex flex-col">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-sm font-medium">GNSS features</CardTitle>
          <div className="flex gap-1">
            {(Object.keys(PRESETS) as PresetKey[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={activePreset === p ? "secondary" : "ghost"}
                className="h-7 text-xs"
                onClick={() => applyPreset(p)}
              >
                {PRESET_LABELS[p]}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-auto space-y-4">
          {FEATURES.map((f) => {
            const v = features[f.key];
            return (
              <div key={f.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <label className="text-sm font-medium">
                    {f.label}{" "}
                    <span className="text-xs text-muted-foreground font-mono">
                      ({f.unit})
                    </span>
                  </label>
                  <span className="font-mono text-sm tabular-nums">
                    {formatValue(v, f.step)}
                  </span>
                </div>
                <Slider
                  value={[v]}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  onValueChange={(val) =>
                    setFeature(
                      f.key,
                      Array.isArray(val) ? (val[0] ?? 0) : Number(val),
                    )
                  }
                />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {f.hint}
                </p>
              </div>
            );
          })}
          <div className="pt-2 sticky bottom-0 -mx-6 px-6 pb-1 bg-card/80 backdrop-blur">
            <Button
              className={cn("w-full")}
              size="lg"
              onClick={submit}
              disabled={score.isPending}
            >
              {score.isPending ? "Scoring..." : "Score this signal"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <OnboardResult
        result={score.data ?? null}
        loading={score.isPending}
      />
    </div>
  );
}

function formatValue(v: number, step: number): string {
  if (step >= 1) return v.toFixed(0);
  if (step >= 0.5) return v.toFixed(1);
  return v.toFixed(2);
}
