import { Radar } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { TabNav } from "./tab-nav";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-6 px-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <Radar className="h-5 w-5 text-primary" aria-hidden />
          <span>GPS Spoofing Sentinel</span>
        </div>
        <TabNav />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
