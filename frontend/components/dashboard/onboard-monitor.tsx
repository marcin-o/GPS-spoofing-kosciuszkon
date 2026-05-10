"use client";

import { motion } from "framer-motion";
import { Plane, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { OnboardTick } from "@/lib/types";
import { fmtAlt, fmtCoord } from "@/lib/format";
import { ScoreBar } from "./score-bar";
import { TopReasons } from "./top-reasons";
import { VerdictPill } from "@/components/shared/verdict-pill";
import { ExplainModal } from "./explain-modal";
import { useHealth } from "@/lib/use-health";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VerdictsMiniStrip } from "@/components/onboard/verdicts-mini-strip";

interface OnboardMonitorProps {
  tick: OnboardTick | null;
  history: OnboardTick[];
  scenarioName: string;
}

const MOTION_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};

export function OnboardMonitor({ tick, history, scenarioName }: OnboardMonitorProps) {
  const [frozenTick, setFrozenTick] = useState<OnboardTick | null>(null);
  const alertFeedRef = useRef<HTMLDivElement>(null);
  const { f1 } = useHealth();

  useEffect(() => {
    if (alertFeedRef.current) alertFeedRef.current.scrollTop = 0;
  }, [tick?.tick]);

  const l1History = useMemo(() => history.map((t) => t.scores.L1.ratio), [history]);
  const l2History = useMemo(() => history.map((t) => t.scores.L2.ratio), [history]);
  const verdictHistory = useMemo(() => history.map((t) => t.verdict), [history]);
  const alertEvents = useMemo(() => history.filter((t) => t.verdict !== "OK"), [history]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 p-4 flex-1 min-h-0 overflow-hidden">
      <div className="flex flex-col gap-4 min-h-0">
        <motion.div variants={MOTION_VARIANTS} initial="initial" animate="animate" transition={{ duration: 0.25 }}>
          <Card className="border-slate-800 bg-slate-900/60 py-4 gap-0">
            <CardContent className="px-4 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <Plane className="h-5 w-5 text-slate-400" aria-hidden />
                <div className="flex flex-col leading-none">
                  <span className="font-mono font-semibold text-xl tracking-tight" data-testid="callsign">
                    {tick?.callsign ?? <Skeleton className="h-5 w-20 inline-block" />}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{scenarioName}</span>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger render={<Stack label="Pozycja" value={tick ? fmtCoord(tick.position.lat, tick.position.lon) : "—"} />} />
                <TooltipContent>Zgłoszone współrzędne GPS z odbiornika (szer., dł.).</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<Stack label="Wysokość" value={tick ? fmtAlt(tick.position.alt) : "—"} />} />
                <TooltipContent>Wysokość barometryczna nad poziomem morza.</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<Stack label="Kurs" value={tick ? `${tick.position.heading.toFixed(0)}°` : "—"} />} />
                <TooltipContent>Kurs rzeczywisty względem ziemi (0° = północ).</TooltipContent>
              </Tooltip>
              <div className="ml-auto flex items-center gap-3">
                {tick ? <VerdictPill verdict={tick.verdict} size="lg" /> : <Skeleton className="h-7 w-24" />}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!tick}
                  onClick={() => tick && setFrozenTick(tick)}
                  className="h-8 text-[11px] uppercase tracking-wider border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Wyjaśnij
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {history.length > 0 && (
          <motion.div variants={MOTION_VARIANTS} initial="initial" animate="animate" transition={{ duration: 0.25, delay: 0.05 }}>
            <VerdictsMiniStrip verdicts={verdictHistory} />
          </motion.div>
        )}

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
          variants={MOTION_VARIANTS}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.25, delay: 0.1 }}
        >
          {tick ? (
            <>
              <ScoreBar
                label="Warstwa L1 — Sygnał (TEXBAT)"
                ratio={tick.scores.L1.ratio}
                threshold={tick.scores.L1.threshold}
                modelVersion={tick.scores.L1.model_version}
                f1={f1.L1}
                history={l1History}
                layer="L1"
              />
              <ScoreBar
                label="Warstwa L2 — Kanał (Aissou)"
                ratio={tick.scores.L2.ratio}
                threshold={tick.scores.L2.threshold}
                modelVersion={tick.scores.L2.model_version}
                f1={f1.L2}
                history={l2History}
                layer="L2"
              />
            </>
          ) : (
            <>
              <Skeleton className="h-32 w-full rounded-md" />
              <Skeleton className="h-32 w-full rounded-md" />
            </>
          )}
        </motion.div>

        <motion.div variants={MOTION_VARIANTS} initial="initial" animate="animate" transition={{ duration: 0.25, delay: 0.15 }}>
          <TopReasons reasons={tick?.top_reasons ?? []} />
        </motion.div>

        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-auto"
          variants={MOTION_VARIANTS}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.25, delay: 0.2 }}
        >
          <Stat label="Tick" value={tick ? `#${tick.tick}` : "—"} />
          <Stat label="Dominująca warstwa" value={tick?.dominant_layer ?? "—"} />
          <Stat label="Inferencja" value={tick ? `${tick.inference_ms.xgboost.toFixed(1)} ms` : "—"} />
          <Stat label="Flaga ataku" value={tick ? (tick.is_attack ? "TAK" : "nie") : "—"} />
        </motion.div>
      </div>

      <motion.aside
        variants={MOTION_VARIANTS}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex flex-col border border-slate-800 bg-slate-900/40 rounded-md overflow-hidden min-h-0"
      >
        <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] tracking-wider uppercase text-slate-400 font-medium">Dziennik alertów</span>
          <span className="ml-auto font-mono text-[10px] text-slate-500">
            {alertEvents.length}/{history.length} zdarzeń
          </span>
        </div>
        <ScrollArea className="flex-1">
          <div ref={alertFeedRef} className="px-2 py-2 flex flex-col gap-1.5">
            {alertEvents.length === 0 && (
              <div className="text-[11px] text-slate-500 italic px-2 py-3 text-center">
                — sygnał czysty, brak zdarzeń —
              </div>
            )}
            {[...alertEvents].reverse().slice(0, 80).map((t) => (
              <AlertRow key={t.tick} tick={t} />
            ))}
          </div>
        </ScrollArea>
      </motion.aside>

      {frozenTick && <ExplainModal tick={frozenTick} onClose={() => setFrozenTick(null)} />}
    </div>
  );
}

function Stack({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 cursor-default">
      <span className="text-[10px] tracking-wider uppercase text-slate-500">{label}</span>
      <span className="font-mono tabular-nums text-sm">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-800 bg-slate-900/40 rounded-sm px-3 py-2 flex flex-col gap-0.5">
      <span className="text-[10px] tracking-wider uppercase text-slate-500">{label}</span>
      <span className="font-mono tabular-nums text-sm text-slate-200">{value}</span>
    </div>
  );
}

function AlertRow({ tick }: { tick: OnboardTick }) {
  const v = tick.verdict;
  const dotClass = v === "OK" ? "bg-emerald-400" : v === "WARNING" ? "bg-amber-400" : "bg-red-500";
  const txtClass = v === "OK" ? "text-emerald-400" : v === "WARNING" ? "text-amber-400" : "text-red-500";
  return (
    <div className="font-mono text-[11px] flex items-center gap-2 px-1.5 py-1 hover:bg-slate-900/60 rounded-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass} flex-none`} />
      <span className="text-slate-500 tabular-nums">#{tick.tick.toString().padStart(3, "0")}</span>
      <span className={`tabular-nums ${txtClass}`}>{tick.scores[tick.dominant_layer].ratio.toFixed(2)}×</span>
      <span className="text-slate-500">{tick.dominant_layer}</span>
      <span className={`uppercase tracking-wider ml-auto text-[10px] ${txtClass}`}>{v}</span>
    </div>
  );
}
