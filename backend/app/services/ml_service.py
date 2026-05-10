"""Pre-score scenario CSVs with the ML-team's batch API, cache per-tick.

Why pre-score: the ML-team's ``ml.inference.score_*`` functions are
DataFrame-batch-shaped (z-score baseline window for TEXBAT, multi-time
trajectory aggregation for OpenSky ensemble). They can't be called
once per WS tick without losing the temporal context they need.

So: at first reference of a scenario we load the CSV, run the relevant
batched scorers once, and stash a per-tick (or per-aircraft per-tick)
result. The WS streams from cache.

We DO NOT touch ``ml/inference.py`` — only call its public API.

Two adaptations applied to make the real models behave on synthetic
demo data:

1. **AISSOU re-calibration** (the docstring on ``score_lstm_ae`` calls
   out the same problem class): synthetic per-channel signal samples
   are out-of-distribution for the real-data-trained classifier — it
   reports ~0.9 mean proba on clean. We compute a per-scenario p99
   threshold on the clean baseline (t<100, is_attack=0) and treat
   that as the new "alert threshold". Predictions above scenario p99
   = alert; below = OK. Original probas still streamed for display.

2. **LSTM-AE dynamic threshold**: the ML-team's ensemble defaults to
   ``threshold_mode='auto'``, which only switches to batch-p95 when the
   batch is ≥50 aircraft. Our fleet is 12, so it stays on the training
   threshold and flags everything. We call ``score_lstm_ae`` directly
   with ``threshold_mode='dynamic'`` and roll our own OR-fusion.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any

import numpy as np
import pandas as pd

from ml.inference import (
    _zscore_against_baseline,
    load_model,
    score_aissou,
    score_lstm_ae,
    score_opensky,
    score_opensky_multitime,
    score_texbat,
)

logger = logging.getLogger(__name__)

_MODELS_DIR = Path(
    os.environ.get(
        "GPS_SENTINEL_MODELS",
        str(Path(__file__).resolve().parents[3] / "models"),
    )
).resolve()

_warmed = False
_latency_cache: dict[str, float] = {}


# ─────────────────────────────────────────────────── per-scenario cache

@dataclass
class OnboardScored:
    n_ticks: int
    l1_proba: list[float]
    l1_threshold: float
    l1_alert: list[bool]
    l1_model_version: str
    l2_proba: list[float]
    l2_threshold_calibrated: float
    l2_alert: list[bool]
    l2_model_version: str
    # SHAP inputs: per-tick feature rows fed to each classifier. Shape
    # (n_ticks, n_features) on the same scaling the model saw.
    l1_X: np.ndarray | None = None  # z-scored TEXBAT features
    l1_feature_names: list[str] | None = None
    l2_X: np.ndarray | None = None  # raw Aissou features
    l2_feature_names: list[str] | None = None


@dataclass
class GlobeScored:
    n_ticks: int
    aircraft_per_tick: list[list[dict]]
    # Each entry: list of {icao24, callsign, country, position dict,
    # ensemble_score: ratio/threshold, sub_scores, dominant_submodel,
    # verdict}


_onboard_cache: dict[str, OnboardScored] = {}
_globe_cache: dict[str, GlobeScored] = {}
_cache_lock = Lock()


# ─────────────────────────────────────────────────── ONBOARD pre-scoring

def _verdict_from_ratio(ratio: float) -> str:
    if ratio >= 1.5:
        return "CRITICAL"
    if ratio >= 1.0:
        return "WARNING"
    return "OK"


def _prescore_onboard(scenario_id: str, csv_path: Path) -> OnboardScored:
    df = pd.read_csv(csv_path)
    n = len(df)
    logger.info("pre-scoring onboard scenario %s (%d rows)", scenario_id, n)

    # ───── L1 — TEXBAT (built-in z-score baseline window does its job)
    r_tx = score_texbat(df, baseline_window=(30, 100), t_col="t_int")
    if "error" in r_tx:
        raise RuntimeError(f"TEXBAT scoring failed for {scenario_id}: {r_tx['error']}")
    l1_proba = list(map(float, r_tx["scores"]))
    l1_thr = float(r_tx["threshold"])
    l1_alert = [p >= l1_thr for p in l1_proba]
    l1_version = "texbat-xgb-v1"
    # Reproduce the z-scored matrix the model saw, so SHAP can use the
    # same row at /api/explain time without re-loading the CSV.
    tx_bundle = load_model("texbat")
    tx_feat_cols = list(tx_bundle["feature_cols"])
    lo, hi = 30, 100
    tx_baseline = df.loc[(df["t_int"] >= lo) & (df["t_int"] < hi), tx_feat_cols]
    l1_X = _zscore_against_baseline(df[tx_feat_cols], tx_baseline).to_numpy(dtype=np.float32)

    # ───── L2 — AISSOU (per-scenario p99 calibration on clean baseline)
    r_ai = score_aissou(df)
    l2_proba = list(map(float, r_ai["scores"]))
    ai_bundle = load_model("aissou")
    ai_feat_cols = list(ai_bundle["feature_cols"])
    l2_X = df[ai_feat_cols].astype(np.float32).to_numpy()
    # Clean baseline = first 100 ticks where is_attack==0.
    is_attack = df["is_attack"].astype(int).tolist() if "is_attack" in df.columns else [0] * n
    baseline = [p for i, p in enumerate(l2_proba) if i < 100 and is_attack[i] == 0]
    if len(baseline) >= 5:
        # p99 of baseline + a small floor so identical-clean scenarios still threshold
        thr = float(max(np.percentile(baseline, 99), 0.5))
    else:
        thr = 0.5
    l2_alert = [p >= thr for p in l2_proba]
    l2_version = "aissou-xgb-binary-v1"
    logger.info("  AISSOU calibrated threshold for %s: %.4f (baseline n=%d)",
                scenario_id, thr, len(baseline))

    return OnboardScored(
        n_ticks=n,
        l1_proba=l1_proba, l1_threshold=l1_thr, l1_alert=l1_alert,
        l1_model_version=l1_version,
        l2_proba=l2_proba, l2_threshold_calibrated=thr, l2_alert=l2_alert,
        l2_model_version=l2_version,
        l1_X=l1_X, l1_feature_names=tx_feat_cols,
        l2_X=l2_X, l2_feature_names=ai_feat_cols,
    )


def get_onboard_scored(scenario_id: str, csv_path: Path) -> OnboardScored:
    with _cache_lock:
        if scenario_id in _onboard_cache:
            return _onboard_cache[scenario_id]
        out = _prescore_onboard(scenario_id, csv_path)
        _onboard_cache[scenario_id] = out
        return out


# ─────────────────────────────────────────────────── GLOBE pre-scoring

def _normalize_v1(score: float, ref: float = 0.5) -> float:
    return float(score / ref)


def _normalize_v2(score: float, ref: float = 0.5) -> float:
    return float(score / ref)


def _normalize_lstm(score: float, threshold: float) -> float:
    if threshold <= 0:
        return 0.0
    return float(score / threshold)


def _prescore_globe(scenario_id: str, csv_path: Path) -> GlobeScored:
    df = pd.read_csv(csv_path)
    n_ticks = int(df["snapshot_idx"].max()) + 1
    logger.info("pre-scoring globe scenario %s (%d ticks, %d aircraft)",
                scenario_id, n_ticks, df["icao24"].nunique())

    # We pre-score by sliding window: at tick t, take all snapshots up
    # to (and including) t. This gives the multi-time scorers
    # progressively more context.
    aircraft_per_tick: list[list[dict]] = []

    # Pre-compute static aircraft metadata.
    meta = (df.groupby("icao24")
              .agg({"callsign": "first", "origin_country": "first"})
              .to_dict("index"))

    for tick in range(n_ticks):
        snap = df[df["snapshot_idx"] <= tick]
        latest = snap.sort_values("snapshot_idx").groupby("icao24").tail(1).reset_index(drop=True)

        # L3v1: single-snapshot
        try:
            r_v1 = score_opensky(latest)
        except Exception as exc:
            logger.warning("score_opensky failed at tick %d: %s", tick, exc)
            r_v1 = {"scores": [], "predictions": [], "kept_indices": []}
        v1_score_by_icao: dict[str, tuple[float, int]] = {}
        for idx, sc, pr in zip(r_v1.get("kept_indices", []),
                                r_v1.get("scores", []),
                                r_v1.get("predictions", [])):
            icao = latest.iloc[idx]["icao24"] if idx < len(latest) else None
            if icao:
                v1_score_by_icao[icao] = (float(sc), int(pr))

        # L3v2: multitime — needs ≥4 snapshots per aircraft (drop earlier ticks)
        v2_score_by_icao: dict[str, tuple[float, int]] = {}
        if tick >= 3:
            try:
                r_v2 = score_opensky_multitime(snap)
                for icao, sc, pr in zip(r_v2.get("aircraft", []),
                                          r_v2.get("scores", []),
                                          r_v2.get("predictions", [])):
                    v2_score_by_icao[icao] = (float(sc), int(pr))
            except Exception as exc:
                logger.warning("score_opensky_multitime failed at tick %d: %s", tick, exc)

        # L4: LSTM-AE — dynamic threshold per call (small batch ⇒ rank-based)
        lstm_score_by_icao: dict[str, tuple[float, int]] = {}
        lstm_threshold_used: float | None = None
        if tick >= 3:
            try:
                r_lstm = score_lstm_ae(snap, threshold_mode="dynamic")
                lstm_threshold_used = float(r_lstm.get("threshold", 0.0))
                for icao, sc, pr in zip(r_lstm.get("aircraft", []),
                                          r_lstm.get("scores", []),
                                          r_lstm.get("predictions", [])):
                    lstm_score_by_icao[icao] = (float(sc), int(pr))
            except Exception as exc:
                logger.warning("score_lstm_ae failed at tick %d: %s", tick, exc)

        # OR-fusion: ensemble_pred = any sub-model alerts; ratio = max normalized.
        rows: list[dict] = []
        all_icao = sorted(set(v1_score_by_icao) | set(v2_score_by_icao) | set(lstm_score_by_icao)
                          | set(latest["icao24"].tolist()))
        for icao in all_icao:
            ac_meta = meta.get(icao, {"callsign": icao, "origin_country": "?"})
            ac_row = latest[latest["icao24"] == icao]
            if ac_row.empty:
                continue
            ar = ac_row.iloc[0]

            v1_s, v1_p = v1_score_by_icao.get(icao, (None, 0))
            v2_s, v2_p = v2_score_by_icao.get(icao, (None, 0))
            l_s, l_p   = lstm_score_by_icao.get(icao, (None, 0))

            n1 = _normalize_v1(v1_s) if v1_s is not None else 0.0
            n2 = _normalize_v2(v2_s) if v2_s is not None else 0.0
            n_lstm = _normalize_lstm(l_s, lstm_threshold_used) if (l_s is not None and lstm_threshold_used) else 0.0

            ratios = {"iforest_v1": n1, "iforest_v2": n2, "lstm_ae": n_lstm}
            dominant = max(ratios.items(), key=lambda kv: kv[1])[0]
            ensemble_ratio = max(ratios.values())
            ensemble_pred = bool(v1_p or v2_p or l_p)

            rows.append({
                "icao24": icao,
                "callsign": ac_meta.get("callsign", icao),
                "origin_country": ac_meta.get("origin_country", "?"),
                "position": {
                    "lat": float(ar["latitude"]),
                    "lon": float(ar["longitude"]),
                    "alt": float(ar["baro_altitude"]),
                    "velocity": float(ar["velocity"]),
                    "true_track": float(ar["true_track"]),
                    "vertical_rate": float(ar.get("vertical_rate", 0.0)),
                    "on_ground": bool(ar.get("on_ground", False)),
                },
                "ensemble_score": {"ratio": float(ensemble_ratio), "threshold": 1.0},
                "sub_scores": {
                    "iforest_v1": {"ratio": float(n1)},
                    "iforest_v2": {"ratio": float(n2)},
                    "lstm_ae":    {"ratio": float(n_lstm)},
                },
                "dominant_submodel": dominant,
                "verdict": _verdict_from_ratio(ensemble_ratio),
                "is_anomaly": bool(int(ar.get("is_anomaly", 0))),
                "anomaly_kind": str(ar.get("anomaly_kind", "")),
                "ensemble_pred": ensemble_pred,
            })
        aircraft_per_tick.append(rows)

    return GlobeScored(n_ticks=n_ticks, aircraft_per_tick=aircraft_per_tick)


def get_globe_scored(scenario_id: str, csv_path: Path) -> GlobeScored:
    with _cache_lock:
        if scenario_id in _globe_cache:
            return _globe_cache[scenario_id]
        out = _prescore_globe(scenario_id, csv_path)
        _globe_cache[scenario_id] = out
        return out


# ─────────────────────────────────────────────────── warm-up + latency

def warm_up() -> dict[str, float]:
    """Kick model files off disk into RAM at startup so the first WS tick
    isn't 800 ms slower than the rest. Doesn't pre-score scenarios — that
    happens lazily on first WS connect."""
    global _warmed
    out: dict[str, float] = {}
    samples = [
        ("texbat",  "scripts/.warmup_texbat.csv"),
        ("aissou",  "scripts/.warmup_aissou.csv"),
        ("opensky", "scripts/.warmup_opensky.csv"),
    ]
    # Build minimal in-memory frames just to force model load.
    try:
        from ml.inference import load_model
        t0 = time.perf_counter()
        load_model("texbat"); out["texbat"] = round((time.perf_counter() - t0) * 1000, 2)
        t0 = time.perf_counter()
        load_model("aissou"); out["aissou"] = round((time.perf_counter() - t0) * 1000, 2)
        t0 = time.perf_counter()
        load_model("opensky"); out["opensky_iforest_v1"] = round((time.perf_counter() - t0) * 1000, 2)
        t0 = time.perf_counter()
        load_model("opensky_multi"); out["opensky_iforest_v2"] = round((time.perf_counter() - t0) * 1000, 2)
        t0 = time.perf_counter()
        load_model("lstm_ae"); out["lstm_ae"] = round((time.perf_counter() - t0) * 1000, 2)
    except Exception as exc:
        logger.warning("warm-up failed: %s", exc)
    _latency_cache.update(out)
    _warmed = True
    return out


def latency() -> dict[str, float]:
    if not _warmed:
        return warm_up()
    return dict(_latency_cache)
