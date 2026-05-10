"use client";

import { ArrowRight } from "lucide-react";

export function TopReasons({ reasons }: { reasons: string[] }) {
  return (
    <div className="border border-slate-800 bg-slate-900/60 rounded-sm p-3 flex flex-col gap-1.5">
      <span className="text-[11px] tracking-wider uppercase text-slate-400 font-medium">Główne przyczyny</span>
      <ul className="flex flex-col gap-1">
        {reasons.length === 0 && <li className="text-xs text-slate-500 italic">— sygnał czysty —</li>}
        {reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-slate-200">
            <ArrowRight className="h-3 w-3 mt-0.5 flex-none text-[#EE3124]" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
