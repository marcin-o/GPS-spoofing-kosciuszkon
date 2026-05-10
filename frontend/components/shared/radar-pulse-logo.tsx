"use client";

import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

interface RadarPulseLogoProps {
  className?: string;
  size?: number;
}

export function RadarPulseLogo({ className, size = 20 }: RadarPulseLogoProps) {
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ boxShadow: "0 0 0 0 rgba(238,49,36,0.55)" }}
        animate={{ boxShadow: ["0 0 0 0 rgba(238,49,36,0.55)", "0 0 0 6px rgba(238,49,36,0)"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
      />
      <motion.span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      >
        <Radar className="h-full w-full text-[#EE3124]" />
      </motion.span>
    </span>
  );
}
