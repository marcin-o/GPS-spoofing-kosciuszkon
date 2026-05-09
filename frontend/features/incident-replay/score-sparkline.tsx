"use client";

import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import type { IncidentReplay } from "@/lib/api/types";

export function ScoreSparkline({
  replay,
  frameIndex,
}: {
  replay: IncidentReplay;
  frameIndex: number;
}) {
  const data = replay.frames.map((f, i) => ({
    i,
    score: f.score,
  }));

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ left: 4, right: 4, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <YAxis hide domain={[0, 1]} />
          <ReferenceLine y={0.7} stroke="#ef4444" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#ef4444"
            strokeWidth={1.5}
            fill="url(#scoreFill)"
            isAnimationActive={false}
          />
          <ReferenceLine
            x={frameIndex}
            stroke="#fafafa"
            strokeWidth={1}
            strokeOpacity={0.6}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
