export type Verdict = "OK" | "WARNING" | "CRITICAL";

export type Mode = "onboard" | "live_globe";

export interface Scenario {
  id: string;
  name: string;
  mode: Mode;
  duration_s: number;
  expected_dominant_layer: string | null;
  description: string;
}

export interface ModelVersion {
  layer: string;
  scenario: string;
  version: string;
  f1: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  model_loaded: boolean;
  model_versions: ModelVersion[];
  inference_latency_ms: Record<string, number>;
}

export interface OnboardScore {
  ratio: number;
  threshold: number;
  raw: number;
  model_version: string;
}

export interface OnboardTick {
  t: number;
  tick: number;
  callsign: string;
  context: "onboard";
  scenario_id: string;
  position: { lat: number; lon: number; alt: number; heading: number };
  scores: { L1: OnboardScore; L2: OnboardScore };
  verdict: Verdict;
  dominant_layer: "L1" | "L2";
  top_reasons: string[];
  inference_ms: { xgboost: number; L1: number; L2: number };
  is_attack: boolean;
}

export interface SubScore {
  ratio: number;
}

export interface AircraftEntry {
  icao24: string;
  callsign: string;
  origin_country: string;
  position: {
    lat: number;
    lon: number;
    alt: number;
    velocity: number;
    true_track: number;
    vertical_rate: number;
    on_ground: boolean;
  };
  ensemble_score: { ratio: number; threshold: number };
  sub_scores: { iforest_v1: SubScore; iforest_v2: SubScore; lstm_ae: SubScore };
  dominant_submodel: "iforest_v1" | "iforest_v2" | "lstm_ae";
  verdict: Verdict;
  last_contact: number;
  is_anomaly: boolean;
  top_reasons: string[];
}

export interface GlobeTick {
  t: number;
  tick: number;
  context: "live_globe";
  scenario_id: string;
  aircraft: AircraftEntry[];
  inference_ms: { ensemble_per_100ac: number; total: number };
}
