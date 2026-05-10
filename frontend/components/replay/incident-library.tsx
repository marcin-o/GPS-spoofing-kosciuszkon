"use client";

import { useEffect, useState } from "react";
import { Library, AlertTriangle, MapPin, Play } from "lucide-react";
import type { Incident } from "@/lib/types";
import { getIncidents } from "@/lib/api";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

interface IncidentLibraryProps {
  onSelect: (incident: Incident) => void;
  selectedId?: string | null;
}

export function IncidentLibrary({ onSelect, selectedId }: IncidentLibraryProps) {
  const open = useUIStore((s) => s.incidentLibraryOpen);
  const setOpen = useUIStore((s) => s.setIncidentLibraryOpen);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);

  useEffect(() => {
    if (!open || incidents) return;
    getIncidents().then(setIncidents);
  }, [open, incidents]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-[11px] uppercase tracking-wider border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700"
          />
        }
      >
        <Library className="h-3.5 w-3.5" />
        Biblioteka incydentów
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-slate-950 border-slate-800 text-slate-100 p-0 flex flex-col gap-0"
      >
        <SheetHeader className="border-b border-slate-800 p-4">
          <SheetTitle className="flex items-center gap-2 text-slate-200 text-sm uppercase tracking-wider">
            <Library className="h-4 w-4 text-[#EE3124]" />
            Incydenty historyczne
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500">
            Realne zdarzenia spoofingowe. Kliknij, by załadować w warstwie detekcji BeDetector.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-3 flex flex-col gap-2">
            {!incidents && (
              <>
                <Skeleton className="h-24 w-full rounded-md" />
                <Skeleton className="h-24 w-full rounded-md" />
                <Skeleton className="h-24 w-full rounded-md" />
              </>
            )}
            {incidents?.map((inc, i) => (
              <motion.button
                key={inc.id}
                onClick={() => {
                  onSelect(inc);
                  setOpen(false);
                }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                className={`text-left rounded-md border bg-slate-900/40 hover:bg-slate-900/70 transition-colors p-3 flex flex-col gap-2 ${
                  selectedId === inc.id ? "border-[#EE3124]/60 bg-[#EE3124]/5" : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-semibold text-sm text-slate-100 truncate">{inc.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                      {inc.date}
                    </span>
                  </div>
                  {inc.casualties && (
                    <Badge variant="destructive" className="text-[9px] uppercase tracking-wider shrink-0">
                      <AlertTriangle className="h-3 w-3" />
                      {inc.casualties}
                    </Badge>
                  )}
                </div>
                {inc.region && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                    <MapPin className="h-3 w-3" />
                    {inc.region}
                  </div>
                )}
                {inc.narrative && (
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{inc.narrative}</p>
                )}
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">
                    {inc.attack_pattern ?? "Wzorzec: —"}
                  </span>
                  <span className="text-[10px] text-[#EE3124] font-mono uppercase tracking-wider flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    Powtórz
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
