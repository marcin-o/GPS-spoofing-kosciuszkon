"""Per-tick scoring layer for the live demo.

Why this is its own thing instead of using ``ml.inference.score()``:
the real ML pipeline (in ``ml/inference.py`` from the ML-team) is built
around batch DataFrames with z-score baseline windows — appropriate for
offline evaluation, not for the per-tick WS replay we drive at 10×
wall-clock. So this module loads the synthetic stand-in models from
``models/`` directly (via joblib + torch) and exposes a dict-in / dict-out
shim shaped like the rest of the backend.

Real models from the ML-team ship next to ours under ``models/``
(``xgboost_texbat_v1.joblib`` etc.) and stay available for the offline
batch path; we just don't drive the live WS through them yet.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from threading import Lock
from typing import Any

import joblib
import numpy as np

from ml.schemas import (
    AISSOU_FEATURES,
    F1_SCORES,
    LSTM_TRAJ_DIM,
    LSTM_TRAJ_LEN,
    MODEL_VERSIONS,
    OPENSKY_FEATURES,
    TEXBAT_FEATURES,
    THRESHOLDS,
)

logger = logging.getLogger(__name__)

_MODELS_DIR = Path(
    os.environ.get(
        "GPS_SENTINEL_MODELS",
        str(Path(__file__).resolve().parents[3] / "models"),
    )
).resolve()

_cache: dict[str, Any] = {}
_load_lock = Lock()
_warmed = False
_latency_cache: dict[str, float] = {}


# ---------------------------------------------------------------- LSTM-AE


def _build_lstm_ae():
    import torch
    from torch import nn

    class LSTMAE(nn.Module):
        def __init__(self, dim: int, hidden: int):
            super().__init__()
            self.encoder = nn.LSTM(dim, hidden, batch_first=True)
            self.decoder = nn.LSTM(hidden, dim, batch_first=True)

        def forward(self, x):
            _, (h, _) = self.encoder(x)
            seq_len = x.shape[1]
            repeated = h[-1].unsqueeze(1).repeat(1, seq_len, 1)
            out, _ = self.decoder(repeated)
            return out

    return LSTMAE


def _load_lstm_ae() -> dict:
    if "lstm_ae" in _cache:
        return _cache["lstm_ae"]
    import torch

    path = _MODELS_DIR / "lstm_ae_v1.pt"
    if not path.exists():
        raise FileNotFoundError(
            f"synthetic LSTM-AE not found at {path}. Run `make ml-train` to build it."
        )
    blob = torch.load(path, map_location="cpu", weights_only=False)
    cls = _build_lstm_ae()
    model = cls(dim=blob["dim"], hidden=blob["hidden"])
    model.load_state_dict(blob["state_dict"])
    model.eval()
    _cache["lstm_ae"] = {
        "model": model,
        "mean": np.array(blob["mean"], dtype=np.float32),
        "std": np.array(blob["std"], dtype=np.float32),
        "threshold": float(blob["threshold"]),
        "version": blob["version"],
    }
    return _cache["lstm_ae"]


# ---------------------------------------------------------------- joblib bundles


_FILE_BY_NAME = {
    "texbat": "texbat_xgb_v1.joblib",
    "aissou": "aissou_xgb_bin_v1.joblib",
    "iforest_v1": "opensky_iforest-v1.joblib",
    "iforest_v2": "opensky_iforest-v2-multitime.joblib",
}


def _load_joblib(name: str) -> dict:
    with _load_lock:
        if name in _cache:
            return _cache[name]
        path = _MODELS_DIR / _FILE_BY_NAME[name]
        if not path.exists():
            raise FileNotFoundError(
                f"synthetic model {name} not found at {path}. "
                "Run `make ml-train` to build the synthetic stand-ins."
            )
        bundle = joblib.load(path)
        _cache[name] = bundle
        logger.info("loaded synthetic model %s from %s", name, path)
        return bundle


# ---------------------------------------------------------------- per-scenario scoring


def _vectorize(payload: dict, feature_list: list[str]) -> np.ndarray:
    vec = np.zeros((1, len(feature_list)), dtype=np.float32)
    for i, name in enumerate(feature_list):
        try:
            vec[0, i] = float(payload.get(name, 0.0))
        except (TypeError, ValueError):
            vec[0, i] = 0.0
    return vec


def _texbat_score(payload: dict) -> dict[str, Any]:
    bundle = _load_joblib("texbat")
    model = bundle["model"]
    feats = bundle["features"]
    x = _vectorize(payload, feats)
    t0 = time.perf_counter()
    proba = float(model.predict_proba(x)[0, 1])
    dt = (time.perf_counter() - t0) * 1000
    threshold = THRESHOLDS["texbat"]
    return {
        "ratio": float(proba / threshold) if threshold > 0 else proba,
        "raw": proba,
        "threshold": threshold,
        "model_version": MODEL_VERSIONS["texbat"],
        "f1": F1_SCORES["texbat"],
        "inference_ms": round(dt, 2),
    }


def _aissou_score(payload: dict) -> dict[str, Any]:
    bundle = _load_joblib("aissou")
    model = bundle["model"]
    feats = bundle["features"]
    x = _vectorize(payload, feats)
    t0 = time.perf_counter()
    proba = float(model.predict_proba(x)[0, 1])
    dt = (time.perf_counter() - t0) * 1000
    threshold = THRESHOLDS["aissou"]
    return {
        "ratio": float(proba / threshold) if threshold > 0 else proba,
        "raw": proba,
        "threshold": threshold,
        "model_version": MODEL_VERSIONS["aissou"],
        "f1": F1_SCORES["aissou"],
        "inference_ms": round(dt, 2),
    }


def _iforest_score(name: str, payload: dict) -> dict[str, Any]:
    bundle = _load_joblib(name)
    model = bundle["model"]
    feats = bundle["features"]
    x = _vectorize(payload, feats)
    t0 = time.perf_counter()
    df = float(model.decision_function(x)[0])
    dt = (time.perf_counter() - t0) * 1000
    raw = max(0.0, -df * 5.0)
    threshold = 1.0
    short = "iforest_v1" if name == "iforest_v1" else "iforest_v2"
    return {
        "ratio": raw / threshold,
        "raw": raw,
        "threshold": threshold,
        "model_version": MODEL_VERSIONS[short],
        "inference_ms": round(dt, 2),
    }


def _lstm_ae_score(trajectory: list[list[float]] | None) -> dict[str, Any]:
    bundle = _load_lstm_ae()
    import torch

    if not trajectory:
        return {
            "ratio": 0.0,
            "raw": 0.0,
            "threshold": bundle["threshold"],
            "model_version": MODEL_VERSIONS["lstm_ae"],
            "inference_ms": 0.0,
        }
    arr = np.asarray(trajectory, dtype=np.float32)
    if arr.ndim == 1:
        arr = arr.reshape(-1, LSTM_TRAJ_DIM)
    if arr.shape[1] != LSTM_TRAJ_DIM:
        pad = np.zeros((arr.shape[0], LSTM_TRAJ_DIM), dtype=np.float32)
        clip = min(arr.shape[1], LSTM_TRAJ_DIM)
        pad[:, :clip] = arr[:, :clip]
        arr = pad
    if arr.shape[0] < LSTM_TRAJ_LEN:
        pad = np.zeros((LSTM_TRAJ_LEN - arr.shape[0], LSTM_TRAJ_DIM), dtype=np.float32)
        if arr.shape[0]:
            pad[:] = arr[-1]
        arr = np.vstack([arr, pad])
    arr = arr[-LSTM_TRAJ_LEN:]
    norm = (arr - bundle["mean"]) / bundle["std"]
    t = torch.tensor(norm).unsqueeze(0)
    t0 = time.perf_counter()
    with torch.no_grad():
        recon = bundle["model"](t)
        err = float(((recon - t) ** 2).mean().item())
    dt = (time.perf_counter() - t0) * 1000
    threshold = bundle["threshold"]
    return {
        "ratio": err / threshold if threshold > 0 else err,
        "raw": err,
        "threshold": threshold,
        "model_version": MODEL_VERSIONS["lstm_ae"],
        "inference_ms": round(dt, 2),
    }


def _opensky_ensemble_score(payload: dict) -> dict[str, Any]:
    sub_v1 = _iforest_score("iforest_v1", payload)
    sub_v2 = _iforest_score("iforest_v2", payload)
    traj = payload.get("trajectory")
    sub_lstm = _lstm_ae_score(traj)

    sub_scores = {"iforest_v1": sub_v1, "iforest_v2": sub_v2, "lstm_ae": sub_lstm}
    ratios = [(k, v["ratio"]) for k, v in sub_scores.items()]
    dominant_key, dominant_ratio = max(ratios, key=lambda kv: kv[1])
    total_ms = sum(v["inference_ms"] for v in sub_scores.values())
    return {
        "ratio": float(dominant_ratio),
        "raw": float(dominant_ratio),
        "threshold": 1.0,
        "model_version": MODEL_VERSIONS["opensky_ensemble"],
        "f1": F1_SCORES["opensky_ensemble"],
        "inference_ms": round(total_ms, 2),
        "sub_scores": {
            k: {
                "ratio": v["ratio"],
                "raw": v["raw"],
                "threshold": v["threshold"],
                "model_version": v["model_version"],
            }
            for k, v in sub_scores.items()
        },
        "dominant_submodel": dominant_key,
    }


# ---------------------------------------------------------------- public API


def run(scenario: str, payload: dict) -> dict[str, Any]:
    s = scenario.lower()
    if s in ("texbat", "l1", "signal"):
        return _texbat_score(payload)
    if s in ("aissou", "l2", "channel"):
        return _aissou_score(payload)
    if s in ("opensky", "opensky_ensemble", "ensemble", "l3"):
        return _opensky_ensemble_score(payload)
    raise ValueError(
        f"Unknown scenario: {scenario!r}. "
        "Expected texbat | aissou | opensky_ensemble."
    )


def warm_up() -> dict[str, float]:
    global _warmed
    samples: list[tuple[str, dict]] = [
        ("texbat", {f: 0.0 for f in TEXBAT_FEATURES}),
        ("aissou", {f: 0.0 for f in AISSOU_FEATURES}),
        ("opensky_ensemble", {
            **{f: 0.0 for f in OPENSKY_FEATURES},
            "trajectory": [[54.0, 18.0, 10000, 230, 90]] * LSTM_TRAJ_LEN,
        }),
    ]
    out: dict[str, float] = {}
    for name, payload in samples:
        t0 = time.perf_counter()
        try:
            run(name, payload)
            dt = (time.perf_counter() - t0) * 1000
            out[name] = round(dt, 2)
        except Exception as exc:
            logger.warning("warm-up failed for %s: %s", name, exc)
            out[name] = -1.0
    _latency_cache.update(out)
    _warmed = True
    return out


def latency() -> dict[str, float]:
    if not _warmed:
        return warm_up()
    return dict(_latency_cache)
