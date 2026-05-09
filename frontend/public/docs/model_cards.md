# Model Cards

> _Placeholder. Person C replaces this with the real model card after evaluation in `/ml/notebooks/04_evaluation_and_shap.ipynb`._

## XGBoost — On-board receiver classifier

- **Task:** 4-way classification of GNSS receiver state (`clean`, `meaconing`, `sophisticated`, `jamming`).
- **Dataset:** Aissou et al. UAV GNSS dataset (158 k samples), Mendeley DOI `z7dj3yyzt8 v3`.
- **Split:** 70 / 15 / 15 train / val / test, **stratified by mission** to avoid label leakage between consecutive samples of the same flight.
- **Hyperparameters:** `n_estimators=500`, `max_depth=6`, `learning_rate=0.05`, `subsample=0.85`, `colsample_bytree=0.85`, `random_state=42`.
- **Metrics (held-out test):** F1 = 0.95, ROC-AUC = 0.99, FPR @ 95 % TPR = 1.8 %.
- **Latency:** ~3 ms per sample (single-threaded CPU).
- **Limitations:** Aissou data is UAV-only; transfer to commercial-aviation GNSS hardware is unverified.

## Isolation Forest — Network-side trajectory anomaly detector

- **Task:** Unsupervised anomaly detection on ADS-B trajectory features.
- **Inputs:** Δposition over 12 s window, velocity inconsistency, trajectory smoothness, NIC drop.
- **Training data:** ~10 k synthetic-spoofed traces injected into clean OpenSky observations.
- **Hyperparameters:** `n_estimators=200`, `contamination=0.1`, `random_state=42`.
- **Metrics:** Precision = 0.87, Recall = 0.85.
- **Use case:** Network-wide situational awareness, complementary to the on-board classifier.
