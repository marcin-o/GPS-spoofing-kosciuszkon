import type { Metadata } from "next";
import { JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const jbMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GNSS Defense Monitor — Kościuszkon 2026",
  description:
    "Real-time GPS spoofing detection across single-aircraft (TEXBAT/Aissou) and fleet (OpenSky) contexts. Honeywell theme.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn("dark h-full antialiased", geist.variable, jbMono.variable, "font-sans")}
    >
      <body className="bg-slate-950 text-slate-100 min-h-full font-sans">
        <TooltipProvider delay={150}>
          {children}
          <Toaster richColors theme="dark" position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
