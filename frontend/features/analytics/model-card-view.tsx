"use client";

import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useModelCard } from "@/lib/api/metrics";

export function ModelCardView() {
  const { data, isLoading } = useModelCard();
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Model cards</CardTitle>
      </CardHeader>
      <CardContent className="prose prose-invert prose-sm max-w-none prose-headings:font-semibold prose-h1:text-base prose-h2:text-sm prose-h2:uppercase prose-h2:tracking-wide prose-h2:text-muted-foreground prose-code:font-mono prose-code:text-xs prose-code:bg-secondary/60 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none">
        {isLoading || !data ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : (
          <ReactMarkdown>{data}</ReactMarkdown>
        )}
      </CardContent>
    </Card>
  );
}
