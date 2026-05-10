import type { Incident, IncidentAnnotation } from "@/lib/types";

export const INCIDENTS_FALLBACK: Incident[] = [
  {
    id: "flight-8243",
    title: "AZAL Flight 8243",
    date: "2024-12-25",
    region: "Caspian Sea — Grozny → Aktau",
    narrative:
      "Embraer 190 lost GPS over Grozny under heavy spoofing, was steered across the Caspian and crashed near Aktau. 38 dead, 29 survivors.",
    attack_pattern: "L1 signal drift + position teleport",
    casualties: "38 fatalities / 29 survivors",
    linked_scenario_id: "texbat_spoof",
    lat: 43.86,
    lon: 51.09,
  },
  {
    id: "hormuz-2025",
    title: "Strait of Hormuz mass spoofing",
    date: "2025-06-18",
    region: "Strait of Hormuz / Bandar Abbas",
    narrative:
      "Over 1,100 vessels reported false positions inside Bandar Abbas airport in 24h. Coordinated AIS/GNSS spoofing; commercial shipping delayed for days.",
    attack_pattern: "Cluster channel + ensemble drift",
    casualties: null,
    linked_scenario_id: "baltic_teleport",
    lat: 26.55,
    lon: 56.37,
  },
  {
    id: "beirut-2024",
    title: "Beirut Airport ghost-fleet",
    date: "2024-04-09",
    region: "Beirut Rafic Hariri Intl.",
    narrative:
      "117 ships displayed identical position inside Beirut airport apron. Pattern matched the 2024 Cyprus spoofing campaign attributed to regional jamming.",
    attack_pattern: "Ensemble anomaly (LSTM-AE)",
    casualties: null,
    linked_scenario_id: "smooth_drift_fleet",
    lat: 33.82,
    lon: 35.49,
  },
];

export const INCIDENT_ANNOTATIONS: Record<string, IncidentAnnotation[]> = {
  "flight-8243": [
    { tick: 30, label: "GPS integrity normal", icon: "check" },
    { tick: 80, label: "NIC drop detected", icon: "alert" },
    { tick: 120, label: "Sentinel: spoofing confirmed", icon: "shield" },
    { tick: 180, label: "Crew reverts to inertial nav", icon: "plane" },
  ],
  "hormuz-2025": [
    { tick: 20, label: "Cluster drift onset", icon: "alert" },
    { tick: 90, label: "Ensemble flag raised", icon: "shield" },
  ],
  "beirut-2024": [
    { tick: 25, label: "Trajectory anomaly", icon: "alert" },
    { tick: 95, label: "LSTM-AE reconstruction breach", icon: "shield" },
  ],
};

export function findIncidentForScenario(scenarioId: string): Incident | undefined {
  return INCIDENTS_FALLBACK.find((i) => i.linked_scenario_id === scenarioId);
}
