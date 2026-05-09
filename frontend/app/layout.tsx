import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"] });
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
      className={`${inter.variable} ${jbMono.variable} h-full antialiased`}
    >
      <body className="bg-slate-950 text-slate-100 min-h-full font-sans">
        {children}
      </body>
    </html>
  );
}
