import type { Incident, IncidentAnnotation } from "@/lib/types";

export const INCIDENTS_FALLBACK: Incident[] = [
  {
    id: "flight-8243",
    title: "AZAL — lot 8243",
    date: "2024-12-25",
    region: "Morze Kaspijskie — Grozny → Aktau",
    narrative:
      "Embraer 190 stracił GPS nad Groznym podczas intensywnego spoofingu, został sprowadzony nad Morze Kaspijskie i rozbił się pod Aktau. 38 ofiar, 29 ocalałych.",
    attack_pattern: "Drift sygnału L1 + skok pozycji",
    casualties: "38 ofiar / 29 ocalałych",
    linked_scenario_id: "texbat_spoof",
    lat: 43.86,
    lon: 51.09,
  },
  {
    id: "hormuz-2025",
    title: "Cieśnina Ormuz — masowy spoofing",
    date: "2025-06-18",
    region: "Cieśnina Ormuz / Bandar Abbas",
    narrative:
      "Ponad 1100 jednostek raportowało fałszywe pozycje wewnątrz lotniska Bandar Abbas w ciągu 24h. Skoordynowany spoofing AIS/GNSS; transport handlowy opóźniony przez kilka dni.",
    attack_pattern: "Klaster kanałów + drift ensemble",
    casualties: null,
    linked_scenario_id: "baltic_teleport",
    lat: 26.55,
    lon: 56.37,
  },
  {
    id: "beirut-2024",
    title: "Lotnisko Bejrut — flota duchów",
    date: "2024-04-09",
    region: "Bejrut Rafic Hariri Intl.",
    narrative:
      "117 statków wyświetliło identyczną pozycję na płycie lotniska Bejrut. Wzorzec pokrywa się z kampanią cypryjską 2024 przypisywaną regionalnemu zagłuszaniu.",
    attack_pattern: "Anomalia ensemble (LSTM-AE)",
    casualties: null,
    linked_scenario_id: "smooth_drift_fleet",
    lat: 33.82,
    lon: 35.49,
  },
];

export const INCIDENT_ANNOTATIONS: Record<string, IncidentAnnotation[]> = {
  "flight-8243": [
    { tick: 30, label: "Integralność GPS w normie", icon: "check" },
    { tick: 80, label: "Wykryto spadek NIC", icon: "alert" },
    { tick: 120, label: "BeDetector: spoofing potwierdzony", icon: "shield" },
    { tick: 180, label: "Załoga przechodzi na nawigację inercyjną", icon: "plane" },
  ],
  "hormuz-2025": [
    { tick: 20, label: "Początek driftu klastra", icon: "alert" },
    { tick: 90, label: "Ensemble podniósł flagę", icon: "shield" },
  ],
  "beirut-2024": [
    { tick: 25, label: "Anomalia trajektorii", icon: "alert" },
    { tick: 95, label: "LSTM-AE przekroczył próg rekonstrukcji", icon: "shield" },
  ],
};

export function findIncidentForScenario(scenarioId: string): Incident | undefined {
  return INCIDENTS_FALLBACK.find((i) => i.linked_scenario_id === scenarioId);
}
