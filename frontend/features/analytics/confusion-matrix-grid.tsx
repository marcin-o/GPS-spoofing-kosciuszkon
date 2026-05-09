"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModelEval } from "@/lib/api/metrics";

export function ConfusionMatrixGrid({
  labels,
  models,
}: {
  labels: string[];
  models: ModelEval[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Confusion matrices (held-out test)
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {models.map((m) => (
          <Matrix key={m.name} model={m} labels={labels} />
        ))}
      </CardContent>
    </Card>
  );
}

function Matrix({ model, labels }: { model: ModelEval; labels: string[] }) {
  const max = Math.max(...model.confusion.flat(), 1);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">
          {model.name}
        </h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          F1 {model.metrics.f1.toFixed(3)} · AUC {model.metrics.roc_auc.toFixed(3)}
        </span>
      </div>
      <div
        className="grid gap-px rounded-md overflow-hidden border border-border/40 bg-border/40"
        style={{ gridTemplateColumns: `auto repeat(${labels.length}, minmax(0, 1fr))` }}
      >
        <div />
        {labels.map((l) => (
          <div
            key={`top-${l}`}
            className="bg-card text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 py-1 text-center"
          >
            {l}
          </div>
        ))}
        {model.confusion.map((row, ri) => (
          <Row
            key={ri}
            label={labels[ri] ?? `r${ri}`}
            row={row}
            max={max}
            color={model.color}
          />
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  row,
  max,
  color,
}: {
  label: string;
  row: number[];
  max: number;
  color: string;
}) {
  return (
    <>
      <div className="bg-card text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 py-2 text-right">
        {label}
      </div>
      {row.map((v, ci) => {
        const intensity = Math.pow(v / max, 0.6);
        return (
          <div
            key={ci}
            className="text-center font-mono text-[11px] px-1.5 py-2 tabular-nums"
            style={{
              backgroundColor: hexWithAlpha(color, 0.12 + intensity * 0.8),
              color: intensity > 0.5 ? "#0f172a" : undefined,
            }}
          >
            {v.toLocaleString()}
          </div>
        );
      })}
    </>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}
