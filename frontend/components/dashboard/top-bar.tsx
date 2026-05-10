"use client";

import { motion } from "framer-motion";
import { Activity, BarChart3, Crosshair, Globe, History, Plane, Radio, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Mode, Scenario } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RadarPulseLogo } from "@/components/shared/radar-pulse-logo";
import { NumberFlow } from "@/components/shared/number-flow";
import { useUIStore } from "@/lib/stores/ui-store";

interface TopBarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  scenario: string;
  onScenarioChange: (id: string) => void;
  scenarios: Scenario[];
  inferenceMs: number | null;
  onExport: () => void;
  mockMode: boolean;
}

const MODE_ICONS = {
  onboard: Plane,
  live_globe: Globe,
  replay: History,
  analytics: BarChart3,
} as const;

const MODE_LABELS: Record<Mode, string> = {
  onboard: "Onboard",
  live_globe: "Live Globe",
  replay: "Replay",
  analytics: "Analytics",
};

export function TopBar({
  mode,
  onModeChange,
  scenario,
  onScenarioChange,
  scenarios,
  inferenceMs,
  onExport,
  mockMode,
}: TopBarProps) {
  const filteredScenarios = mode === "replay" || mode === "analytics"
    ? scenarios
    : scenarios.filter((s) => s.mode === mode);

  const audioEnabled = useUIStore((s) => s.audioEnabled);
  const voiceLLMEnabled = useUIStore((s) => s.voiceLLMEnabled);
  const toggleAudio = useUIStore((s) => s.toggleAudio);
  const toggleVoiceLLM = useUIStore((s) => s.toggleVoiceLLM);

  const latencyTone = inferenceMs == null
    ? "text-slate-600"
    : inferenceMs < 10
    ? "text-emerald-400"
    : inferenceMs < 30
    ? "text-amber-400"
    : "text-red-400";

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-4 px-4 h-14">
        <div className="flex items-center gap-2.5">
          <RadarPulseLogo size={22} />
          <div className="flex flex-col leading-none">
            <span className="font-semibold tracking-tight text-sm">GNSS DEFENSE MONITOR</span>
            <span className="font-mono text-[10px] text-slate-500 tracking-wider mt-0.5">
              KOŚCIUSZKON 2026 · HONEYWELL
            </span>
          </div>
        </div>

        <Tabs
          value={mode}
          onValueChange={(v) => onModeChange(v as Mode)}
          className="ml-2"
        >
          <TabsList variant="line" className="h-8 gap-0.5 border border-slate-800 bg-slate-900/40 rounded-md px-1">
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => {
              const Icon = MODE_ICONS[m];
              const active = mode === m;
              return (
                <TabsTrigger
                  key={m}
                  value={m}
                  className={cn(
                    "relative h-7 rounded-sm px-3 text-[11px] uppercase tracking-wider transition-colors",
                    "text-slate-400 hover:text-slate-100 data-active:text-white",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="topbar-mode-pill"
                      className="absolute inset-0 rounded-sm bg-[#EE3124]/15 ring-1 ring-[#EE3124]/40 shadow-[0_0_18px_rgba(238,49,36,0.25)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {MODE_LABELS[m]}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {mode !== "analytics" && (
          <div className="ml-1 flex items-center gap-2">
            <span className="text-[10px] tracking-wider uppercase text-slate-500">scenario</span>
            <Select
              value={scenario}
              onValueChange={(v) => v != null && onScenarioChange(v)}
            >
              <SelectTrigger className="h-8 min-w-[230px] bg-slate-900/60 border-slate-800 text-xs font-mono focus-visible:ring-[#EE3124]/40">
                <SelectValue placeholder="Select scenario" />
              </SelectTrigger>
              <SelectContent>
                {filteredScenarios.map((s) => {
                  const Icon = s.mode === "onboard" ? Plane : Globe;
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      <Icon className="h-3.5 w-3.5 text-slate-500" />
                      <span className="font-mono text-xs">{s.name}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {mockMode && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-[10px] uppercase tracking-wider"
            >
              <Activity className="h-3 w-3 animate-pulse" />
              Mock — backend offline
            </Badge>
          )}

          <Badge
            variant="outline"
            className="border-slate-800 bg-slate-900/40 font-mono text-[10px] uppercase tracking-wider"
          >
            <Radio className={cn("h-3 w-3", mockMode ? "text-amber-400" : "text-emerald-400")} />
            {mockMode ? "MOCK" : "LIVE"}
          </Badge>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <Crosshair className={cn("h-3.5 w-3.5", latencyTone)} />
            <span className="tracking-wider uppercase text-[10px] text-slate-500">INFERENCE</span>
            <span className={cn("tabular-nums transition-colors", latencyTone)} data-testid="inference-latency">
              {inferenceMs == null ? (
                "—"
              ) : (
                <>
                  <NumberFlow value={inferenceMs} format={(n) => n.toFixed(0)} />
                  <span className="text-slate-500"> ms</span>
                </>
              )}
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={toggleAudio}
                  className={cn(
                    "h-8 w-8 inline-flex items-center justify-center rounded-md border transition-colors",
                    audioEnabled
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-slate-900/40 text-slate-500 hover:text-slate-300",
                  )}
                  aria-label={audioEnabled ? "Mute alerts" : "Unmute alerts"}
                />
              }
            />
            <TooltipContent>{audioEnabled ? "Audio: on" : "Audio: muted"}</TooltipContent>
            {audioEnabled ? <Volume2 className="h-3.5 w-3.5 pointer-events-none" /> : <VolumeX className="h-3.5 w-3.5 pointer-events-none" />}
          </Tooltip>

          <div className="flex items-center gap-1.5 border border-slate-800 bg-slate-900/40 rounded-md px-2 h-8">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              {voiceLLMEnabled ? "voice" : "beep"}
            </span>
            <Switch
              checked={voiceLLMEnabled}
              onCheckedChange={() => toggleVoiceLLM()}
              aria-label="Toggle voice alert"
              className="data-[state=checked]:bg-[#EE3124]"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-8 text-[11px] uppercase tracking-wider border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700"
          >
            Export Report
          </Button>
        </div>
      </div>
    </header>
  );
}
