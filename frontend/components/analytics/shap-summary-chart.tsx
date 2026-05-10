"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { SHAP_GLOBAL } from "@/lib/analytics-data";

export function ShapSummaryChart() {
  return (
    <Card className="border-slate-800 bg-slate-900/50 gap-2 py-3 h-full">
      <CardHeader className="px-4 gap-1">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
          <Sparkles className="h-4 w-4 text-[#EE3124]" />
          SHAP — global
        </CardTitle>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
          Mean |contribution| · positive share = red
        </span>
      </CardHeader>
      <CardContent className="px-2 pb-3 flex-1">
        <div className="w-full h-[280px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
            <BarChart data={SHAP_GLOBAL} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <XAxis
                type="number"
                domain={[0, 0.4]}
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
                cursor={{ fill: "rgba(238,49,36,0.06)" }}
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 4,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                }}
                labelStyle={{ color: "#cbd5e1" }}
                formatter={(value, _name, item) => {
                  const payload = (item as { payload?: { positiveShare?: number } } | undefined)?.payload;
                  const share = payload?.positiveShare ?? 0;
                  return [
                    Number(value).toFixed(3),
                    `mean |SHAP|  ·  +${(share * 100).toFixed(0)}% positive`,
                  ];
                }}
              />
              <Bar dataKey="meanAbs" radius={[0, 3, 3, 0]}>
                {SHAP_GLOBAL.map((row) => {
                  const intensity = Math.min(1, 0.4 + row.positiveShare * 0.6);
                  return <Cell key={row.feature} fill={`rgba(238,49,36,${intensity.toFixed(2)})`} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
