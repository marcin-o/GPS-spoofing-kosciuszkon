"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FeatureImportance({
  data,
}: {
  data: { feature: string; value: number }[];
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          XGBoost feature importance
        </CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ left: 0, right: 12, top: 4, bottom: 4 }}
          >
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="feature"
              type="category"
              stroke="#64748b"
              width={150}
              tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderColor: "#1e293b",
                fontSize: 12,
              }}
              formatter={(v) => Number(v).toFixed(3)}
            />
            <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
