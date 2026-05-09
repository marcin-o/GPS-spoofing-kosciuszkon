"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const AnalyticsClient = dynamic(
  () => import("@/features/analytics/analytics-client"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  },
);

export default function AnalyticsPage() {
  return (
    <div className="flex-1 p-6 min-h-0 overflow-auto">
      <header className="pb-3">
        <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Model evaluation, SHAP, and the drone tier video — fed from{" "}
          <code className="font-mono">public/data/metrics.json</code>.
        </p>
      </header>
      <AnalyticsClient />
    </div>
  );
}
