// SOURCE: Person C ML training results — replace with measured numbers when available.
// Numbers below are deterministic placeholders aligned with the spec'd F1 ceilings,
// so the comparison table tells a coherent story even before training rounds finish.

export interface ModelComparison {
  name: string;
  family: "linear" | "tree" | "ensemble" | "anomaly" | "deep";
  f1: number;
  precision: number;
  recall: number;
  auc: number;
}

export const MODEL_COMPARISON: ModelComparison[] = [
  { name: "Logistic Regression",       family: "linear",  f1: 0.812, precision: 0.794, recall: 0.831, auc: 0.873 },
  { name: "Random Forest",             family: "tree",    f1: 0.931, precision: 0.912, recall: 0.951, auc: 0.964 },
  { name: "XGBoost — TEXBAT (L1)",     family: "tree",    f1: 0.984, precision: 0.972, recall: 0.997, auc: 0.992 },
  { name: "XGBoost — Aissou (L2)",     family: "tree",    f1: 0.976, precision: 0.962, recall: 0.991, auc: 0.987 },
  { name: "Isolation Forest (L3)",     family: "anomaly", f1: 0.852, precision: 0.781, recall: 0.937, auc: 0.911 },
  { name: "LSTM Autoencoder (L3)",     family: "deep",    f1: 0.935, precision: 0.901, recall: 0.972, auc: 0.953 },
  { name: "Ensemble (Sentinel)",       family: "ensemble", f1: 0.989, precision: 0.984, recall: 0.995, auc: 0.997 },
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
