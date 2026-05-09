"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex-1 grid place-items-center p-6">
      <Card className="max-w-lg">
        <CardContent className="space-y-3 p-6">
          <h2 className="text-base font-semibold text-red-400">
            Something broke on this view
          </h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "Unknown error"}
            {error.digest && (
              <span className="block font-mono text-xs mt-1">
                digest: {error.digest}
              </span>
            )}
          </p>
          <Button onClick={reset} variant="default" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
