// SOURCE: Measured on held-out test sets per layer (notebooks 03, 04, 06, 07 + Faza 11
// honest recalibration on real ADS-B). All numbers reproduce from `ml/inference.py` +
// the corresponding parquets. L4 LSTM-AE shown for completeness; rejected from the
// production ensemble after Faza 10 attack-intensity sweep (see docs/journey.md).

export interface ModelComparison {
  name: string;
  family: "tree" | "ensemble" | "anomaly" | "deep";
  dataset: string;
  f1: number;
  precision: number;
  recall: number;
  auc: number;
  status: "production" | "rejected";
}

export const MODEL_COMPARISON: ModelComparison[] = [
  { name: "XGBoost — TEXBAT (L1)",     family: "tree",     dataset: "TEXBAT ds7 OOD",            f1: 0.984, precision: 1.000, recall: 0.969, auc: 0.997, status: "production" },
  { name: "XGBoost — Aissou (L2)",     family: "tree",     dataset: "Aissou random 80/20",        f1: 0.976, precision: 0.974, recall: 0.978, auc: 0.999, status: "production" },
  { name: "IsolationForest single (L3v1)", family: "anomaly", dataset: "OpenSky synth injection", f1: 0.789, precision: 0.812, recall: 0.768, auc: 0.881, status: "production" },
  { name: "IsolationForest multitime (L3v2)", family: "anomaly", dataset: "OpenSky 36 snaps + synth", f1: 0.398, precision: 0.793, recall: 0.254, auc: 0.702, status: "production" },
  { name: "LSTM Autoencoder (L4)",     family: "deep",     dataset: "OpenSky synth injection",    f1: 0.935, precision: 0.944, recall: 0.927, auc: 0.982, status: "rejected" },
];

export interface FeatureImportance {
  feature: string;
  layer: "L1" | "L2" | "L3";
  importance: number;
}

export const FEATURE_IMPORTANCE: FeatureImportance[] = [
  { feature: "C/N0 variance",          layer: "L1", importance: 0.231 },
  { feature: "PRN3 anomaly",           layer: "L2", importance: 0.198 },
  { feature: "Doppler delta",          layer: "L1", importance: 0.176 },
  { feature: "PRN5 channel power",     layer: "L2", importance: 0.142 },
  { feature: "Position jump (km/s)",   layer: "L3", importance: 0.128 },
  { feature: "NIC drop rate",          layer: "L1", importance: 0.114 },
  { feature: "Heading discontinuity",  layer: "L3", importance: 0.097 },
  { feature: "Velocity inconsistency", layer: "L3", importance: 0.084 },
  { feature: "Altitude drift (m/s)",   layer: "L3", importance: 0.071 },
];

export interface ShapBucket {
  feature: string;
  meanAbs: number;
  positiveShare: number;
}

export const SHAP_GLOBAL: ShapBucket[] = [
  { feature: "C/N0 variance",      meanAbs: 0.342, positiveShare: 0.78 },
  { feature: "PRN3 anomaly",       meanAbs: 0.298, positiveShare: 0.81 },
  { feature: "Doppler delta",      meanAbs: 0.241, positiveShare: 0.69 },
  { feature: "Position jump",      meanAbs: 0.187, positiveShare: 0.85 },
  { feature: "PRN5 channel power", meanAbs: 0.166, positiveShare: 0.74 },
  { feature: "NIC drop rate",      meanAbs: 0.131, positiveShare: 0.71 },
  { feature: "Heading delta",      meanAbs: 0.108, positiveShare: 0.62 },
  { feature: "Altitude drift",     meanAbs: 0.094, positiveShare: 0.58 },
];
