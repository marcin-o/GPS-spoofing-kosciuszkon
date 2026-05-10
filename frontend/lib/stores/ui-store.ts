"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Mode } from "@/lib/types";

interface UIState {
  audioEnabled: boolean;
  voiceLLMEnabled: boolean;
  incidentLibraryOpen: boolean;

  toggleAudio: () => void;
  toggleVoiceLLM: () => void;
  setIncidentLibraryOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      audioEnabled: true,
      voiceLLMEnabled: false,
      incidentLibraryOpen: false,

      toggleAudio: () => set((s) => ({ audioEnabled: !s.audioEnabled })),
      toggleVoiceLLM: () => set((s) => ({ voiceLLMEnabled: !s.voiceLLMEnabled })),
      setIncidentLibraryOpen: (open) => set({ incidentLibraryOpen: open }),
    }),
    {
      name: "gnss-ui-prefs",
      partialize: (s) => ({
        audioEnabled: s.audioEnabled,
        voiceLLMEnabled: s.voiceLLMEnabled,
      }),
    },
  ),
);

export type { Mode };
