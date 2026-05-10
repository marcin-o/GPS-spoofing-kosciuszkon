"use client";

import { Cpu, Gauge, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealth } from "@/lib/use-health";

interface ModelTile {
  layer: "L1" | "L2" | "L3";
  title: string;
  subtitle: string;
  iconColor: string;
}

const TILES: ModelTile[] = [
  { layer: "L1", title: "Layer L1 — Signal", subtitle: "TEXBAT XGBoost", iconColor: "text-cyan-300" },
  { layer: "L2", title: "Layer L2 — Channel", subtitle: "Aissou XGBoost", iconColor: "text-violet-300" },
  { layer: "L3", title: "Layer L3 — Trajectory", subtitle: "Ensemble + LSTM-AE", iconColor: "text-amber-300" },
];

export function ModelOverviewCards() {
  const { health, f1 } = useHealth();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {TILES.map((t, i) => {
        const f1Value = f1[t.layer];
        const latency =
          health?.inference_latency_ms == null
            ? null
            : typeof health.inference_latency_ms === "number"
            ? health.inference_latency_ms
            : (health.inference_latency_ms as Record<string, number>)[t.layer.toLowerCase()] ?? null;
        return (
          <motion.div
            key={t.layer}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.06 }}
          >
            <Card className="border-slate-800 bg-slate-900/50 gap-2 py-3">
              <CardHeader className="px-4 gap-1">
                <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
                  <Layers className={`h-4 w-4 ${t.iconColor}`} />
                  {t.title}
                </CardTitle>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                  {t.subtitle}
                </span>
              </CardHeader>
              <CardContent className="px-4 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Gauge className="h-3 w-3" /> F1
                  </span>
                  {f1Value != null ? (
                    <span className="font-mono tabular-nums text-2xl font-semibold text-emerald-300">
                      {f1Value.toFixed(3)}
                    </span>
                  ) : (
                    <Skeleton className="h-7 w-16" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Cpu className="h-3 w-3" /> Latency
                  </span>
                  {latency != null ? (
                    <span className="font-mono tabular-nums text-2xl font-semibold text-slate-200">
                      {latency.toFixed(1)}<span className="text-xs text-slate-500 ml-1">ms</span>
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-slate-500">—</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
