"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/lib/api/metrics";
import { Card, CardContent } from "@/components/ui/card";
import { ComparisonTable } from "./comparison-table";
import { ConfusionMatrixGrid } from "./confusion-matrix-grid";
import { RocOverlay } from "./roc-overlay";
import { FeatureImportance } from "./feature-importance";
import { ShapSummary } from "./shap-summary";
import { TradeoffCurve } from "./tradeoff-curve";
import { DroneVideoCard } from "./drone-video-card";
import { ModelCardView } from "./model-card-view";

export default function AnalyticsClient() {
  const { data, isLoading, error } = useAnalytics();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-red-400">
          Failed to load analytics data: {String(error)}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ComparisonTable models={data.models} />
      <ConfusionMatrixGrid labels={data.labels} models={data.models} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 [&>*]:min-w-0">
        <RocOverlay models={data.models} />
        <TradeoffCurve data={data.tradeoff} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 [&>*]:min-w-0">
        <FeatureImportance data={data.feature_importance} />
        <ShapSummary data={data.shap_summary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 [&>*]:min-w-0">
        <DroneVideoCard />
        <ModelCardView />
      </div>
    </div>
  );
}
