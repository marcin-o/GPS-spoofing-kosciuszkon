"use client";

import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

interface NumberFlowProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

const DEFAULT_FORMAT = (n: number) => n.toFixed(0);

export function NumberFlow({ value, format = DEFAULT_FORMAT, duration = 0.4, className }: NumberFlowProps) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (n) => format(n));

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [value, duration, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}
