"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, MapPin, Plane, Shield } from "lucide-react";
import type { Incident, IncidentAnnotation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const ICON_MAP = {
  alert: AlertTriangle,
  check: CheckCircle2,
  shield: Shield,
  plane: Plane,
} as const;

interface IncidentNarrativeProps {
  incident: Incident;
  annotations: IncidentAnnotation[];
  currentTick: number;
  totalTicks: number;
}

export function IncidentNarrative({ incident, annotations, currentTick, totalTicks }: IncidentNarrativeProps) {
  const sentinelDetectionTick = annotations.find((a) => a.icon === "shield")?.tick ?? null;
  const reachedSentinel = sentinelDetectionTick !== null && currentTick >= sentinelDetectionTick;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-3"
    >
      <Card className="border-slate-800 bg-slate-900/60 gap-2 py-3">
        <CardHeader className="px-3 gap-1">
          <CardTitle className="flex items-start gap-2 text-slate-100 text-sm">
            <Plane className="h-4 w-4 text-[#EE3124] mt-0.5" />
            <div className="flex flex-col">
              <span>{incident.title}</span>
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">
                {incident.date}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 flex flex-col gap-2">
          {incident.region && (
            <div className="flex items-center gap-1 text-[11px] text-slate-300 font-mono">
              <MapPin className="h-3 w-3 text-slate-500" />
              {incident.region}
            </div>
          )}
          {incident.casualties && (
            <Badge variant="destructive" className="self-start text-[9px] uppercase tracking-wider">
              <AlertTriangle className="h-3 w-3" />
              {incident.casualties}
            </Badge>
          )}
          {incident.narrative && (
            <p className="text-xs text-slate-300 leading-relaxed">{incident.narrative}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/60 gap-2 py-3">
        <CardHeader className="px-3 gap-0">
          <CardTitle className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          <ul className="flex flex-col gap-2">
            {annotations.map((a, i) => {
              const passed = currentTick >= a.tick;
              const Icon = ICON_MAP[a.icon ?? "alert"];
              return (
                <li
                  key={i}
                  className={`flex items-center gap-2 text-[11px] font-mono transition-opacity ${
                    passed ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      passed
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-800 text-slate-500"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <span className="tabular-nums text-slate-500">T+{a.tick}</span>
                  <span className={passed ? "text-slate-200" : "text-slate-500"}>{a.label}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {reachedSentinel && sentinelDetectionTick !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-[#EE3124]/40 bg-[#EE3124]/5 gap-2 py-3">
            <CardContent className="px-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#EE3124]" />
                <span className="text-[11px] uppercase tracking-wider text-[#EE3124] font-semibold">
                  Sentinel Detection
                </span>
              </div>
              <div className="font-mono text-xs text-slate-200">
                Detected at <span className="text-[#EE3124]">T+{sentinelDetectionTick}</span> of {totalTicks}.
                <Separator className="my-1.5 bg-slate-800" />
                <span className="text-[10px] text-slate-400 leading-relaxed block">
                  In a real cockpit, this lead-time gives the crew the opportunity to drop GPS, fall back to
                  inertial nav, and request manual vectors before the spoofed track diverges.
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
