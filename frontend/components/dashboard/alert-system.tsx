"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useUIStore } from "@/lib/stores/ui-store";
import { playBeep } from "@/lib/audio/beep";
import { playVoiceAlert, resolveAlertId } from "@/lib/audio/voice-alert";
import type { Verdict } from "@/lib/types";

export interface AlertEvent {
  id: string;
  ts: number;
  verdict: Verdict;
  context: "onboard" | "live_globe";
  callsign: string;
  layer: string;
  ratio: number;
  reason: string;
  scenarioId?: string;
}

interface AlertSystemProps {
  events: AlertEvent[];
}

const BANNER_DURATION_MS = 6000;

export function AlertSystem({ events }: AlertSystemProps) {
  const audioEnabled = useUIStore((s) => s.audioEnabled);
  const voiceLLMEnabled = useUIStore((s) => s.voiceLLMEnabled);
  const [bannerEvent, setBannerEvent] = useState<AlertEvent | null>(null);
  const [flash, setFlash] = useState(false);
  const seenRef = useRef(new Set<string>());
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    for (const ev of events) {
      if (seenRef.current.has(ev.id)) continue;
      seenRef.current.add(ev.id);

      if (ev.verdict === "WARNING") {
        toast.warning(`${ev.callsign} — ${ev.layer}`, {
          description: ev.reason,
          duration: 3500,
        });
      } else if (ev.verdict === "CRITICAL") {
        toast.error(`SPOOFING — ${ev.layer} — ${ev.callsign}`, {
          description: `ratio ${ev.ratio.toFixed(2)}× · ${ev.reason}`,
          duration: 5500,
        });

        setBannerEvent(ev);
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setBannerEvent(null), BANNER_DURATION_MS);

        setFlash(true);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setFlash(false), 500);

        if (audioEnabled) {
          if (voiceLLMEnabled) {
            const alertId = resolveAlertId(ev.scenarioId ?? "", ev.callsign);
            const loadingToast = toast.loading("🔊 Generating voice alert…", { duration: 4000 });
            playVoiceAlert({ alertId }).then((mode) => {
              toast.dismiss(loadingToast);
              if (mode === "beep") {
                toast.message("Voice unavailable — beep fallback", { duration: 1800 });
              }
            });
          } else {
            playBeep();
          }
        }
      }
    }
  }, [events, audioEnabled, voiceLLMEnabled]);

  return (
    <>
      <AnimatePresence>
        {flash && (
          <motion.div
            className="fixed inset-0 bg-[#EE3124]/35 pointer-events-none z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bannerEvent && (
          <motion.div
            className="fixed top-14 left-0 right-0 z-50"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="bg-[#EE3124] text-white border-b-2 border-red-700 px-6 py-3 flex items-center gap-4 shadow-2xl">
              <AlertTriangle className="h-6 w-6 flex-none animate-pulse" />
              <div className="flex flex-col leading-tight">
                <span className="font-semibold tracking-wider uppercase text-sm">
                  Spoofing detected — {bannerEvent.layer} — {bannerEvent.callsign}
                </span>
                <span className="font-mono text-xs opacity-95">
                  ratio {bannerEvent.ratio.toFixed(2)}× · {bannerEvent.reason}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
