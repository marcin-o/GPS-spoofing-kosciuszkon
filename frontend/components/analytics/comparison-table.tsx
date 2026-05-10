"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MODEL_COMPARISON } from "@/lib/analytics-data";
import { TableProperties } from "lucide-react";
import { cn } from "@/lib/utils";

const FAMILY_COLOR: Record<string, string> = {
  linear: "text-slate-400",
  tree: "text-cyan-300",
  ensemble: "text-[#EE3124]",
  anomaly: "text-amber-300",
  deep: "text-violet-300",
};

function tone(value: number, threshold: number) {
  return value >= threshold + 0.05
    ? "text-emerald-300"
    : value >= threshold
    ? "text-emerald-400/80"
    : value >= threshold - 0.08
    ? "text-amber-300"
    : "text-slate-400";
}

export function ComparisonTable() {
  return (
    <Card className="border-slate-800 bg-slate-900/50 gap-2 py-3">
      <CardHeader className="px-4 gap-1">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
          <TableProperties className="h-4 w-4 text-[#EE3124]" />
          Model comparison
        </CardTitle>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
          Held-out test split · scenario-mixed
        </span>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-slate-800">
              <TableHead className="text-[10px] uppercase tracking-wider text-slate-500">Model</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wider text-slate-500">F1</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wider text-slate-500">Precision</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wider text-slate-500">Recall</TableHead>
              <TableHead className="text-right text-[10px] uppercase tracking-wider text-slate-500">AUC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODEL_COMPARISON.map((m) => (
              <TableRow key={m.name} className="hover:bg-slate-900/40 border-slate-900">
                <TableCell className={cn("font-mono text-xs", FAMILY_COLOR[m.family])}>{m.name}</TableCell>
                <TableCell className={cn("text-right tabular-nums font-mono text-xs", tone(m.f1, 0.9))}>
                  {m.f1.toFixed(3)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums font-mono text-xs", tone(m.precision, 0.9))}>
                  {m.precision.toFixed(3)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums font-mono text-xs", tone(m.recall, 0.9))}>
                  {m.recall.toFixed(3)}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums font-mono text-xs", tone(m.auc, 0.9))}>
                  {m.auc.toFixed(3)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
