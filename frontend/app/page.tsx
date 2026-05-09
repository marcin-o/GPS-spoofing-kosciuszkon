"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const LiveGlobeClient = dynamic(
  () => import("@/features/live-globe/live-globe-client"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 grid place-items-center bg-slate-950">
        <Skeleton className="h-8 w-48" />
      </div>
    ),
  },
);

export default function LiveGlobePage() {
  return <LiveGlobeClient />;
}
