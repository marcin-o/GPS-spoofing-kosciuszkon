import { OnboardForm } from "@/features/onboard-detector/onboard-form";

export default function OnboardPage() {
  return (
    <div className="flex-1 p-6 min-h-0">
      <header className="pb-3">
        <h1 className="text-lg font-semibold tracking-tight">
          On-board Detector
        </h1>
        <p className="text-sm text-muted-foreground">
          Receiver-side classifier — feed GNSS signal features, get a spoofing
          score with SHAP-backed explanation.
        </p>
      </header>
      <OnboardForm />
    </div>
  );
}
