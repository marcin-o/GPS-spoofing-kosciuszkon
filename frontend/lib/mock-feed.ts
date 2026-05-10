import type { GlobeTick, OnboardTick, ReplayBundle, Verdict } from "./types";

const FLEET = [
  { icao24: "4ca87b", cs: "RYR2KE", country: "Ireland", lat: 54.4, lon: 18.5, alt: 11000, vel: 230, hdg: 90 },
  { icao24: "471f8b", cs: "LOT283", country: "Poland",  lat: 52.5, lon: 20.9,  alt: 9500, vel: 220, hdg: 320 },
  { icao24: "3c6589", cs: "DLH4ZW", country: "Germany", lat: 53.5, lon: 14.5, alt: 11500, vel: 240, hdg: 80 },
  { icao24: "4b1805", cs: "SWR12X", country: "Switzerland", lat: 52.8, lon: 18.0, alt: 10800, vel: 235, hdg: 200 },
  { icao24: "440048", cs: "BAW893", country: "United Kingdom", lat: 53.0, lon: 16.0, alt: 12000, vel: 250, hdg: 60 },
  { icao24: "4ac9b0", cs: "SAS2HK", country: "Sweden", lat: 55.5, lon: 17.0, alt: 10500, vel: 220, hdg: 120 },
  { icao24: "3917a3", cs: "AFR1219", country: "France", lat: 51.0, lon: 14.5, alt: 11000, vel: 225, hdg: 150 },
  { icao24: "46b8c1", cs: "FIN6KP", country: "Finland", lat: 56.0, lon: 21.0, alt: 10000, vel: 215, hdg: 200 },
];

export interface MockFeedOptions {
  scenario: string;
  onTick: (tick: OnboardTick | GlobeTick) => void;
}

interface OnboardFeedState {
  tickIdx: number;
  lat: number;
  lon: number;
}

export function startOnboardMock(opts: MockFeedOptions): () => void {
  const state: OnboardFeedState = {
    tickIdx: 0,
    lat: 52.165,
    lon: 20.967,
  };
  const interval = setInterval(() => {
    const tick = buildOnboardTick(opts.scenario, state);
    opts.onTick(tick);
    state.tickIdx += 1;
  }, 125);
  return () => clearInterval(interval);
}

function buildOnboardTick(scenario: string, state: OnboardFeedState): OnboardTick {
  const i = state.tickIdx;
  const t = i / 200;
  state.lat = 52.165 + (54.378 - 52.165) * Math.min(1, t);
  state.lon = 20.967 + (18.466 - 20.967) * Math.min(1, t);

  const attackOnset = scenario === "normal_waw_gdn" ? Infinity : 100;
  const intensity = Math.max(0, Math.min(1, (i - attackOnset) / 30));
  const isL1 = scenario === "texbat_spoof";
  const isL2 = scenario === "aissou_channel_attack";

  const noise = () => (Math.random() - 0.5) * 0.05;
  const baseL1 = 0.15 + noise();
  const baseL2 = 0.18 + noise();
  const L1 = isL1 ? baseL1 + intensity * 1.7 : baseL1;
  const L2 = isL2 ? baseL2 + intensity * 1.7 : baseL2;
  const dom: "L1" | "L2" = L1 >= L2 ? "L1" : "L2";
  const overall = Math.max(L1, L2);
  const verdict: Verdict = overall >= 1.5 ? "CRITICAL" : overall >= 1.0 ? "WARNING" : "OK";

  const reasons: string[] = [];
  if (verdict !== "OK") {
    if (dom === "L1") {
      reasons.push("Wariancja C/N₀ spadła o 73% w ostatnich 30s");
      reasons.push(`Residuum pseudorange: ${(40 + intensity * 90).toFixed(0)}m (próg: 50m)`);
      reasons.push("AGC podniesiony do 0.7×");
    } else {
      reasons.push("Anomalia kanału PRN3: 3.4σ");
      reasons.push("Anomalia kanału PRN5: 2.9σ");
    }
  } else {
    reasons.push("Sygnał TEXBAT w normie");
    reasons.push("Wszystkie 8 kanałów Aissou stabilne");
  }

  return {
    t: Date.now(),
    tick: i,
    callsign: "LOT283",
    context: "onboard",
    scenario_id: scenario,
    position: { lat: state.lat, lon: state.lon, alt: 9500 + 200 * Math.sin(i * 0.1), heading: 327 },
    scores: {
      L1: { ratio: L1, threshold: 0.5, raw: L1 * 0.5, model_version: "texbat-xgb-v1" },
      L2: { ratio: L2, threshold: 0.5, raw: L2 * 0.5, model_version: "aissou-xgb-bin-v1" },
    },
    verdict,
    dominant_layer: dom,
    top_reasons: reasons,
    inference_ms: { xgboost: 3.2, L1: 1.8, L2: 1.4 },
    is_attack: intensity > 0,
  };
}

interface GlobeFeedState {
  tickIdx: number;
  fleet: Array<{ icao24: string; cs: string; country: string; lat: number; lon: number; alt: number; vel: number; hdg: number }>;
}

export function startGlobeMock(opts: MockFeedOptions): () => void {
  const fleet = FLEET.map((f) => ({ ...f }));
  const state: GlobeFeedState = { tickIdx: 0, fleet };
  const interval = setInterval(() => {
    const tick = buildGlobeTick(opts.scenario, state);
    opts.onTick(tick);
    state.tickIdx += 1;
  }, 375);
  return () => clearInterval(interval);
}

function buildGlobeTick(scenario: string, state: GlobeFeedState): GlobeTick {
  const i = state.tickIdx;
  const targets = scenario === "baltic_teleport" ? new Set(["RYR2KE", "DLH4ZW"]) : new Set(["BAW893", "AFR1219"]);
  const onset = 8;

  const aircraft = state.fleet.map((ac) => {
    // Step movement.
    const dt = 1.5;
    const distM = ac.vel * dt;
    const R = 6371000;
    const br = (ac.hdg * Math.PI) / 180;
    const lat1 = (ac.lat * Math.PI) / 180;
    const lon1 = (ac.lon * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distM / R) + Math.cos(lat1) * Math.sin(distM / R) * Math.cos(br));
    const lon2 = lon1 + Math.atan2(Math.sin(br) * Math.sin(distM / R) * Math.cos(lat1), Math.cos(distM / R) - Math.sin(lat1) * Math.sin(lat2));
    ac.lat = (lat2 * 180) / Math.PI;
    ac.lon = (lon2 * 180) / Math.PI;

    let ratio = 0.15 + Math.random() * 0.1;
    let dom: "iforest_v1" | "iforest_v2" = "iforest_v1";
    let isAnomaly = false;
    if (i >= onset && targets.has(ac.cs)) {
      isAnomaly = true;
      if (scenario === "baltic_teleport" && i === onset + 4) {
        ac.lat += 2.5;
        ac.lon -= 1.5;
      }
      if (scenario === "baltic_teleport" && i >= onset + 4) {
        ratio = 2.4 + Math.random() * 0.4;
        dom = "iforest_v2";
      } else if (scenario === "smooth_drift_fleet") {
        const intens = Math.min(1, (i - onset) / 20);
        ac.lat += 0.04 * intens;
        ac.lon -= 0.06 * intens;
        ratio = 0.7 + intens * 1.3;
        dom = "iforest_v2";
      }
    }
    const verdict: Verdict = ratio >= 1.5 ? "CRITICAL" : ratio >= 1.0 ? "WARNING" : "OK";

    const reasons = isAnomaly
      ? ["IsolationForest v2: niespójność wieloskali", `Skok pozycji: Δlat=${(scenario === "baltic_teleport" ? 2.5 : 0.04).toFixed(2)}°`]
      : ["Wszystkie warstwy w normie"];

    return {
      icao24: ac.icao24,
      callsign: ac.cs,
      origin_country: ac.country,
      position: { lat: ac.lat, lon: ac.lon, alt: ac.alt, velocity: ac.vel, true_track: ac.hdg, vertical_rate: 0, on_ground: false },
      ensemble_score: { ratio, threshold: 1.0 },
      sub_scores: {
        iforest_v1: { ratio: dom === "iforest_v1" ? ratio : Math.min(0.6, ratio * 0.5) },
        iforest_v2: { ratio: dom === "iforest_v2" ? ratio : Math.min(0.6, ratio * 0.6) },
      },
      dominant_submodel: dom,
      verdict,
      last_contact: Date.now(),
      is_anomaly: isAnomaly,
      top_reasons: reasons,
    };
  });

  return {
    t: Date.now(),
    tick: i,
    context: "live_globe",
    scenario_id: scenario,
    aircraft,
    inference_ms: { ensemble_per_100ac: 48, total: aircraft.length * 0.48 },
  };
}

// ─────────────────────────────────────────────── mock replay bundles

const ONBOARD_SCENARIOS = new Set(["normal_waw_gdn", "texbat_spoof", "aissou_channel_attack"]);

export function buildMockReplay(scenario: string, n = 200): ReplayBundle {
  const isOnboard = ONBOARD_SCENARIOS.has(scenario);

  if (isOnboard) {
    const state: OnboardFeedState = { tickIdx: 0, lat: 52.165, lon: 20.967 };
    const ticks: OnboardTick[] = [];
    for (let i = 0; i < n; i++) {
      state.tickIdx = i;
      ticks.push({ ...buildOnboardTick(scenario, state), effective_tick: i } as OnboardTick & { effective_tick: number });
    }
    return { kind: "replay_init", scenario_id: scenario, mode: "onboard", duration_s: n * 0.5, ticks };
  }

  const fleet = FLEET.map((f) => ({ ...f }));
  const state: GlobeFeedState = { tickIdx: 0, fleet };
  const ticks: GlobeTick[] = [];
  for (let i = 0; i < n; i++) {
    state.tickIdx = i;
    ticks.push({ ...buildGlobeTick(scenario, state), effective_tick: i } as GlobeTick & { effective_tick: number });
  }
  return { kind: "replay_init", scenario_id: scenario, mode: "live_globe", duration_s: n * 1.5, ticks };
}
