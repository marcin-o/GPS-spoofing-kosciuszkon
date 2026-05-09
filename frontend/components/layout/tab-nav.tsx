"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Live Globe" },
  { href: "/replay", label: "Incident Replay" },
  { href: "/onboard", label: "On-board" },
  { href: "/analytics", label: "Analytics" },
] as const;

export function TabNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1" aria-label="Primary">
      {tabs.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
