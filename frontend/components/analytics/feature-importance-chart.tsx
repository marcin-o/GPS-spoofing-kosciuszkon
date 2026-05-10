"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { FEATURE_IMPORTANCE } from "@/lib/analytics-data";

const LAYER_COLOR: Record<"L1" | "L2" | "L3", string> = {
  L1: "#22d3ee",
  L2: "#a78bfa",
  L3: "#f59e0b",
};

export function FeatureImportanceChart() {
  return (
    <Card className="border-slate-800 bg-slate-900/50 gap-2 py-3 h-full">
      <CardHeader className="px-4 gap-1">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
          <BarChart3 className="h-4 w-4 text-[#EE3124]" />
          Ważność cech
        </CardTitle>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
          XGBoost gain · top 9
        </span>
      </CardHeader>
      <CardContent className="px-2 pb-3 flex-1">
        <div className="w-full h-[280px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
            <BarChart data={FEATURE_IMPORTANCE} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <XAxis
                type="number"
                domain={[0, 0.25]}
                stroke="#475569"
                tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="feature"
                stroke="#94a3b8"
                width={140}
                tick={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
                tickLine={false}
                axisLine={false}
              />
              <RTooltip
                cursor={{ fill: "rgba(148,163,184,0.06)" }}
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 4,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                }}
                labelStyle={{ color: "#cbd5e1" }}
                formatter={(value) => [Number(value).toFixed(3), "ważność"]}
              />
              <Bar dataKey="importance" radius={[0, 3, 3, 0]}>
                {FEATURE_IMPORTANCE.map((row) => (
                  <Cell key={row.feature} fill={LAYER_COLOR[row.layer]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
