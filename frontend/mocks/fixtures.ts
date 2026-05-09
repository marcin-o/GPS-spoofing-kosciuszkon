import type {
  Flight,
  IncidentReplay,
  IncidentSummary,
  Ship,
} from "@/lib/api/types";

const seedAircraft: Array<Pick<Flight, "icao24" | "callsign" | "lat" | "lon" | "alt_m" | "vel_kt" | "heading">> = [
  { icao24: "424351", callsign: "AFL2548", lat: 55.7, lon: 37.6, alt_m: 10668, vel_kt: 432, heading: 92 },
  { icao24: "60c1ec", callsign: "AZG8243", lat: 43.34, lon: 45.7, alt_m: 8800, vel_kt: 418, heading: 65 },
  { icao24: "738064", callsign: "THY1234", lat: 41.0, lon: 28.9, alt_m: 11200, vel_kt: 460, heading: 280 },
  { icao24: "896412", callsign: "EK202", lat: 25.25, lon: 55.36, alt_m: 11800, vel_kt: 478, heading: 305 },
  { icao24: "a0e3fb", callsign: "UAL900", lat: 40.6, lon: -73.8, alt_m: 9750, vel_kt: 440, heading: 78 },
  { icao24: "4ca5e4", callsign: "FR1024", lat: 52.31, lon: 4.94, alt_m: 11500, vel_kt: 448, heading: 110 },
  { icao24: "06a0fa", callsign: "QTR901", lat: 25.27, lon: 51.61, alt_m: 11600, vel_kt: 462, heading: 320 },
  { icao24: "4baa12", callsign: "TK17", lat: 36.95, lon: 30.79, alt_m: 10300, vel_kt: 405, heading: 200 },
  { icao24: "489003", callsign: "SU123", lat: 55.97, lon: 37.41, alt_m: 9100, vel_kt: 396, heading: 175 },
  { icao24: "750a01", callsign: "EY777", lat: 24.43, lon: 54.65, alt_m: 11300, vel_kt: 470, heading: 290 },
];

const scorePalette = [0.05, 0.12, 0.18, 0.34, 0.42, 0.61, 0.74, 0.83, 0.91, 0.96];

function levelFor(score: number): Flight["alert_level"] {
  if (score >= 0.7) return "critical";
  if (score >= 0.4) return "warn";
  return "ok";
}

function reasonsFor(score: number): string[] {
  if (score >= 0.7)
    return [
      "trajectory δ-position spike (>3σ)",
      "NIC dropped from 8 to 0 in 12s",
      "velocity inconsistent with reported heading",
    ];
  if (score >= 0.4) return ["mild trajectory smoothness anomaly"];
  return [];
}

export const mockFlights: Flight[] = seedAircraft.map((a, i) => {
  const score = scorePalette[i % scorePalette.length];
  return {
    ...a,
    nic: score >= 0.7 ? 0 : 8,
    spoofing_score: score,
    alert_level: levelFor(score),
    reasons: reasonsFor(score),
  };
});

export const mockShips: Ship[] = [
  { mmsi: "311042000", name: "EVER GIVEN", lat: 26.65, lon: 56.25, sog: 12.4, cog: 270, spoofing_score: 0.18, alert_level: "ok", reasons: [] },
  { mmsi: "636019825", name: "OOCL TOKYO", lat: 26.71, lon: 56.31, sog: 0.0, cog: 0, spoofing_score: 0.86, alert_level: "critical", reasons: ["reported position inside Bandar Abbas airport perimeter", "static for >2h while AIS active"] },
  { mmsi: "215211000", name: "MARAN GAS", lat: 33.93, lon: 35.49, sog: 0.0, cog: 0, spoofing_score: 0.92, alert_level: "critical", reasons: ["Beirut airport cluster — 117 vessels reporting identical position"] },
  { mmsi: "538008217", name: "MSC HAMBURG", lat: 26.52, lon: 56.02, sog: 14.7, cog: 92, spoofing_score: 0.11, alert_level: "ok", reasons: [] },
  { mmsi: "636017123", name: "GENESIS RIVER", lat: 26.6, lon: 56.18, sog: 0.0, cog: 0, spoofing_score: 0.78, alert_level: "critical", reasons: ["GNSS jamming pattern", "static at sea"] },
];

export const mockIncidents: IncidentSummary[] = [
  {
    id: "flight-8243",
    title: "Azerbaijan Airlines Flight 8243",
    date: "2024-12-25",
    type: "aviation",
    region: "Grozny → Aktau",
    summary:
      "E-190 lost GPS reliability in Grozny region under reported jamming/spoofing; diverted across Caspian and crashed near Aktau (38 fatalities).",
  },
  {
    id: "hormuz-2025",
    title: "Strait of Hormuz GPS spoofing surge",
    date: "2025-06-15",
    type: "maritime",
    region: "Bandar Abbas / Persian Gulf",
    summary:
      "Over 1,100 vessels reported in 24h with positions inside Bandar Abbas airport perimeter — classic ship-on-land spoofing pattern.",
  },
  {
    id: "beirut-2024",
    title: "Beirut Airport ship-cluster anomaly",
    date: "2024-04-10",
    type: "maritime",
    region: "Beirut, Lebanon",
    summary:
      "117 ships simultaneously reporting GPS position inside Beirut–Rafic Hariri airport — confirmed spoofing per Windward report.",
  },
];

function buildReplayFrames(
  start: { lat: number; lon: number },
  driftDeg: { lat: number; lon: number },
  count: number,
): IncidentReplay["frames"] {
  const frames: IncidentReplay["frames"] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const lat_real = start.lat + driftDeg.lat * t * 0.6;
    const lon_real = start.lon + driftDeg.lon * t * 0.6;
    const drift = Math.max(0, t - 0.25);
    const lat_reported = lat_real + drift * driftDeg.lat * 1.4;
    const lon_reported = lon_real + drift * driftDeg.lon * 1.4;
    const score =
      drift === 0 ? 0.05 + Math.random() * 0.05 : Math.min(0.97, 0.3 + drift * 1.4);
    frames.push({
      ts: i * 5,
      lat_real,
      lon_real,
      lat_reported,
      lon_reported,
      score: Number(score.toFixed(2)),
    });
  }
  return frames;
}

export const mockReplays: Record<string, IncidentReplay> = {
  "flight-8243": {
    id: "flight-8243",
    title: "Azerbaijan Airlines Flight 8243",
    frames: buildReplayFrames({ lat: 43.32, lon: 45.7 }, { lat: 1.4, lon: 4.2 }, 144),
  },
  "hormuz-2025": {
    id: "hormuz-2025",
    title: "Strait of Hormuz GPS spoofing surge",
    frames: buildReplayFrames({ lat: 26.7, lon: 56.3 }, { lat: -0.05, lon: -0.18 }, 96),
  },
  "beirut-2024": {
    id: "beirut-2024",
    title: "Beirut Airport ship-cluster anomaly",
    frames: buildReplayFrames({ lat: 33.93, lon: 35.49 }, { lat: 0.04, lon: -0.07 }, 72),
  },
};
