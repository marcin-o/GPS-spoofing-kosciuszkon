"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ModelOverviewCards } from "./model-overview-cards";
import { ComparisonTable } from "./comparison-table";
import { FeatureImportanceChart } from "./feature-importance-chart";
import { ShapSummaryChart } from "./shap-summary-chart";
import { ScrollArea } from "@/components/ui/scroll-area";

const IncidentsMap = dynamic(() => import("./incidents-map").then((m) => m.IncidentsMap), {
  ssr: false,
});

const STAGGER = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, delay: i * 0.05 },
});

export function AnalyticsView() {
  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="flex flex-col gap-4 p-4">
        <motion.div {...STAGGER(0)}>
          <ModelOverviewCards />
        </motion.div>

        <motion.div {...STAGGER(1)}>
          <ComparisonTable />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div {...STAGGER(2)} className="h-full">
            <FeatureImportanceChart />
          </motion.div>
          <motion.div {...STAGGER(3)} className="h-full">
            <ShapSummaryChart />
          </motion.div>
        </div>

        <motion.div {...STAGGER(4)}>
          <IncidentsMap />
        </motion.div>
      </div>
    </ScrollArea>
  );
}
