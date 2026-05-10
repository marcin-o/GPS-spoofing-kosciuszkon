"use client";

import { API_BASE } from "@/lib/api";
import { playBeep } from "./beep";

const KNOWN_INCIDENT_IDS = new Set(["flight-8243", "hormuz-2025", "beirut-2024"]);

let bipAudio: HTMLAudioElement | null = null;
let voiceAudio: HTMLAudioElement | null = null;

function ensureAudio() {
  if (typeof window === "undefined") return;
  if (!bipAudio) {
    bipAudio = new Audio("/sounds/cockpit-bip.mp3");
    bipAudio.volume = 0.55;
    bipAudio.preload = "auto";
  }
  if (!voiceAudio) {
    voiceAudio = new Audio();
    voiceAudio.volume = 0.85;
    voiceAudio.preload = "auto";
  }
}

export function resolveAlertId(scenarioId: string, callsign?: string): string {
  if (scenarioId === "texbat_spoof") return "flight-8243";
  if (scenarioId === "baltic_teleport") return "hormuz-2025";
  if (scenarioId === "smooth_drift_fleet") return "beirut-2024";
  if (callsign) {
    const matched = callsign.match(/(\d{3,4})/);
    if (matched) return `flight-${matched[1]}`;
  }
  return "flight-spoof";
}

interface PlayOptions {
  alertId: string;
  fallbackToBeep?: boolean;
}

export async function playVoiceAlert({ alertId, fallbackToBeep = true }: PlayOptions): Promise<"voice" | "beep" | "skip"> {
  ensureAudio();
  if (!voiceAudio || !bipAudio) {
    if (fallbackToBeep) playBeep();
    return "beep";
  }

  try {
    if (KNOWN_INCIDENT_IDS.has(alertId)) {
      try {
        bipAudio.currentTime = 0;
        await bipAudio.play();
      } catch { /* best-effort BIP */ }
    }

    voiceAudio.src = `${API_BASE}/api/alerts/${encodeURIComponent(alertId)}/speak`;
    await voiceAudio.play();
    return "voice";
  } catch {
    if (fallbackToBeep) playBeep();
    return "beep";
  }
}
