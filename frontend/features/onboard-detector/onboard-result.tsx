"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/score-badge";
import type { AlertLevel, OnboardScoreResponse } from "@/lib/api/types";

const CLASS_LABEL: Record<OnboardScoreResponse["class"], string> = {
  clean: "Authentic GNSS",
  meaconing: "Meaconing (replay)",
  sophisticated: "Sophisticated spoof",
  jamming: "Jamming",
  unknown: "Unknown",
};

const CLASS_NARRATIVE: Record<OnboardScoreResponse["class"], string> = {
  clean: "Signal characteristics consistent with authentic GNSS reception.",
  meaconing:
    "Signal looks legitimate but timing inconsistencies suggest a delayed re-broadcast (meaconing).",
  sophisticated:
    "Multiple receiver-level features deviate from authentic GNSS. High likelihood of a sophisticated spoofing attack.",
  jamming:
    "Significant power drop with degraded SV count — pattern matches jamming rather than spoofing.",
  unknown: "Model is not confident; manual review recommended.",
};

export function OnboardResult({
  result,
  loading,
}: {
  result: OnboardScoreResponse | null;
  loading: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Detection</CardTitle>
          {result && (
            <ScoreBadge level={levelFor(result.score)} score={result.score} />
          )}
        </div>
        {result && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-border/60 font-mono uppercase tracking-wide"
            >
              {CLASS_LABEL[result.class]}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {!result && !loading && (
          <p className="text-sm text-muted-foreground">
            Pick a preset or tune the features manually, then click{" "}
            <span className="font-mono">Score</span>.
          </p>
        )}

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <div className="space-y-2 pt-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        )}

        {result && !loading && (
          <>
            <p className="text-sm text-foreground/85 leading-relaxed">
              {CLASS_NARRATIVE[result.class]}
            </p>

            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                SHAP top-5
              </h3>
              <ShapBars contributions={result.shap} />
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function levelFor(score: number): AlertLevel {
  return score >= 0.7 ? "critical" : score >= 0.4 ? "warn" : "ok";
}

function ShapBars({
  contributions,
}: {
  contributions: { feature: string; value: number; contribution: number }[];
}) {
  const sorted = [...contributions].sort(
    (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
  );
  const top = sorted.slice(0, 5);
  const maxAbs = Math.max(...top.map((c) => Math.abs(c.contribution)), 0.01);
  return (
    <ul className="space-y-2">
      {top.map((c) => {
        const positive = c.contribution >= 0;
        const pct = (Math.abs(c.contribution) / maxAbs) * 100;
        return (
          <li key={c.feature} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono">{c.feature}</span>
              <span className="font-mono text-muted-foreground">
                value {c.value}
                <span className={positive ? "ml-2 text-red-400" : "ml-2 text-emerald-400"}>
                  {positive ? "+" : ""}
                  {c.contribution.toFixed(2)}
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={positive ? "h-full bg-red-400/80" : "h-full bg-emerald-400/80"}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
