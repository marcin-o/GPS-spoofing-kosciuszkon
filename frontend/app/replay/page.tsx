"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const IncidentReplayClient = dynamic(
  () => import("@/features/incident-replay/incident-replay-client"),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 p-6">
        <Skeleton className="h-full w-full" />
      </div>
    ),
  },
);

export default function IncidentReplayPage() {
  return <IncidentReplayClient />;
}
