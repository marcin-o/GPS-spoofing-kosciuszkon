"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TradeoffCurve({
  data,
}: {
  data: { threshold: number; fpr: number; detection_rate: number }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Detection rate vs. FPR (XGBoost)
        </CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data} margin={{ left: 8, right: 12, top: 4, bottom: 8 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="fpr"
              type="number"
              domain={[0, 0.2]}
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => v.toFixed(2)}
              label={{
                value: "FPR",
                position: "insideBottom",
                offset: -4,
                fill: "#64748b",
                fontSize: 11,
              }}
            />
            <YAxis
              dataKey="detection_rate"
              type="number"
              domain={[0, 1]}
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => v.toFixed(1)}
              label={{
                value: "Detection rate",
                angle: -90,
                position: "insideLeft",
                fill: "#64748b",
                fontSize: 11,
              }}
            />
            <ReferenceLine
              x={0.02}
              stroke="#10b981"
              strokeDasharray="4 4"
              label={{ value: "operating point", fill: "#10b981", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#1e293b",
                fontSize: 12,
              }}
              formatter={(v, n) => [Number(v).toFixed(3), String(n)]}
              labelFormatter={(v) => `FPR ${Number(v).toFixed(3)}`}
            />
            <Line
              type="monotone"
              dataKey="detection_rate"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
