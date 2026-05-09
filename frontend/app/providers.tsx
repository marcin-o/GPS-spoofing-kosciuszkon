"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";

// Suppress a Recharts 3 + React 19 strict-mode false positive.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const realWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.includes("width(-1) and height(-1)")) return;
    realWarn(...args);
  };
}

// Default ON in dev; opt out with NEXT_PUBLIC_USE_MSW=false to hit a real backend.
const USE_MSW =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_USE_MSW !== "false";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
        staleTime: 10_000,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={client}>
        <MSWGate>{children}</MSWGate>
        <Toaster richColors closeButton position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// Gates fetch-driven content until MSW registers. Layout/header/theme sit
// above so the theme-provider script tag stays in SSR output.
function MSWGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!USE_MSW);

  useEffect(() => {
    if (!USE_MSW || typeof window === "undefined") return;
    let cancelled = false;
    import("@/mocks/browser")
      .then(async ({ worker }) => {
        await worker.start({
          onUnhandledRequest: "bypass",
          serviceWorker: { url: "/mockServiceWorker.js" },
          quiet: true,
        });
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        console.error("[MSW] failed to start, falling through:", e);
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex-1 flex flex-col gap-3 p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="flex-1 w-full min-h-[300px]" />
      </div>
    );
  }
  return <>{children}</>;
}
