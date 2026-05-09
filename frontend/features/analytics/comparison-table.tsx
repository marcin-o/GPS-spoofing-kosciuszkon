"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModelEval } from "@/lib/api/metrics";

const COLS: Array<{
  key: keyof ModelEval["metrics"];
  label: string;
  fmt: (v: number) => string;
  hi?: "max" | "min";
}> = [
  { key: "accuracy", label: "Accuracy", fmt: (v) => v.toFixed(3), hi: "max" },
  { key: "precision", label: "Precision", fmt: (v) => v.toFixed(3), hi: "max" },
  { key: "recall", label: "Recall", fmt: (v) => v.toFixed(3), hi: "max" },
  { key: "f1", label: "F1", fmt: (v) => v.toFixed(3), hi: "max" },
  { key: "roc_auc", label: "ROC-AUC", fmt: (v) => v.toFixed(3), hi: "max" },
  {
    key: "fpr_at_95tpr",
    label: "FPR @ 95% TPR",
    fmt: (v) => v.toFixed(3),
    hi: "min",
  },
];

export function ComparisonTable({ models }: { models: ModelEval[] }) {
  const winners = COLS.map((c) => {
    const vals = models.map((m) => m.metrics[c.key]);
    const idx =
      c.hi === "min"
        ? vals.indexOf(Math.min(...vals))
        : vals.indexOf(Math.max(...vals));
    return idx;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Model comparison (same split, same metrics)
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase text-muted-foreground tracking-wide">
              <th className="text-left py-2 pr-3 font-medium">Model</th>
              {COLS.map((c) => (
                <th key={c.key} className="text-right py-2 px-2 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((m, mi) => (
              <tr key={m.name} className="border-t border-border/40">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: m.color }}
                      aria-hidden
                    />
                    <span className="font-medium">{m.name}</span>
                  </div>
                </td>
                {COLS.map((c, ci) => (
                  <td
                    key={c.key}
                    className={`py-2 px-2 text-right font-mono tabular-nums ${
                      winners[ci] === mi ? "text-emerald-400 font-semibold" : ""
                    }`}
                  >
                    {c.fmt(m.metrics[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
