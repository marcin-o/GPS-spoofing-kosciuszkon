"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ModelEval } from "@/lib/api/metrics";

export function RocOverlay({ models }: { models: ModelEval[] }) {
  const fprPoints = uniqueSorted(models.flatMap((m) => m.roc.map(([f]) => f)));
  const data = fprPoints.map((fpr) => {
    const row: Record<string, number> = { fpr };
    for (const m of models) row[m.name] = interp(m.roc, fpr);
    return row;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">ROC curves (overlay)</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data} margin={{ left: 8, right: 12, top: 4, bottom: 8 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="fpr"
              type="number"
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
              stroke="#64748b"
              tickFormatter={(v) => v.toFixed(1)}
              label={{
                value: "False positive rate",
                position: "insideBottom",
                offset: -4,
                fill: "#64748b",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              ticks={[0, 0.5, 1]}
              stroke="#64748b"
              tickFormatter={(v) => v.toFixed(1)}
              label={{
                value: "TPR",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 11,
              }}
            />
            <ReferenceLine
              segment={[
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ]}
              stroke="#475569"
              strokeDasharray="4 4"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#1e293b",
                fontSize: 12,
              }}
              formatter={(v) => Number(v).toFixed(3)}
              labelFormatter={(v) => `FPR ${Number(v).toFixed(3)}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {models.map((m) => (
              <Line
                key={m.name}
                type="monotone"
                dataKey={m.name}
                stroke={m.color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function uniqueSorted(xs: number[]): number[] {
  return Array.from(new Set(xs)).sort((a, b) => a - b);
}

function interp(roc: [number, number][], fpr: number): number {
  if (fpr <= roc[0][0]) return roc[0][1];
  if (fpr >= roc[roc.length - 1][0]) return roc[roc.length - 1][1];
  for (let i = 0; i < roc.length - 1; i++) {
    const [x0, y0] = roc[i];
    const [x1, y1] = roc[i + 1];
    if (fpr >= x0 && fpr <= x1) {
      const t = (fpr - x0) / Math.max(1e-9, x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return 0;
}
