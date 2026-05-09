"""GET /api/explain/{tick_id} — real SHAP TreeExplainer per tick.

`tick_id` is the FE-generated `{scenario_id}-{tick}` (see
`frontend/components/dashboard/explain-modal.tsx`). We resolve it
against the cached `OnboardScored` produced by `ml_service`, pick the
dominant layer (L1 vs L2 by proba ratio), and run SHAP on the row the
model actually saw.

TreeExplainers are cached per model (created once per process) — the
explanation itself is ~5 ms for a single row.
"""
from __future__ import annotations

import logging
from threading import Lock
from typing import Any

import numpy as np
import shap
from fastapi import APIRouter, HTTPException

from app.services import ml_service, replay_engine
from ml.inference import load_model

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/explain", tags=["explain"])

_explainer_cache: dict[str, shap.TreeExplainer] = {}
_explainer_lock = Lock()

TOP_K = 6


def _get_explainer(model_name: str) -> shap.TreeExplainer:
    with _explainer_lock:
        if model_name not in _explainer_cache:
            bundle = load_model(model_name)
            _explainer_cache[model_name] = shap.TreeExplainer(bundle["model"])
            logger.info("created SHAP TreeExplainer for %s", model_name)
        return _explainer_cache[model_name]


def _shap_for_row(model_name: str, x_row: np.ndarray) -> tuple[np.ndarray, float]:
    """Returns (per-feature shap values, base value) for the positive class."""
    explainer = _get_explainer(model_name)
    sv = explainer.shap_values(x_row.reshape(1, -1))
    # XGBoost binary returns a 2-D array (1, n_features) for the positive class.
    arr = np.asarray(sv[0]) if isinstance(sv, list) else np.asarray(sv).reshape(-1)
    if arr.ndim == 2:
        arr = arr.reshape(-1)
    base = float(np.asarray(explainer.expected_value).reshape(-1)[-1])
    return arr.astype(float), base


def _top_features(
    feature_names: list[str], x_row: np.ndarray, shap_row: np.ndarray, k: int = TOP_K,
) -> list[dict[str, Any]]:
    order = np.argsort(-np.abs(shap_row))[:k]
    return [
        {
            "feature": feature_names[i],
            "value": float(x_row[i]),
            "contribution": float(shap_row[i]),
        }
        for i in order
    ]


@router.get("/{tick_id}")
def explain(tick_id: str) -> dict[str, object]:
    if "-" not in tick_id:
        raise HTTPException(400, f"tick_id must be '{{scenario_id}}-{{tick}}', got {tick_id!r}")
    scenario_id, _, tick_str = tick_id.rpartition("-")
    try:
        tick_idx = int(tick_str)
    except ValueError:
        raise HTTPException(400, f"tick_id tail must be int, got {tick_str!r}")

    meta = replay_engine.get_meta(scenario_id)
    if meta is None or meta["mode"] != "onboard":
        raise HTTPException(404, f"unknown onboard scenario {scenario_id!r}")

    csv_path = replay_engine._csv_path(scenario_id)
    scored = ml_service.get_onboard_scored(scenario_id, csv_path)
    eff = replay_engine.effective_tick(scenario_id, tick_idx) % scored.n_ticks

    # Pick dominant layer by ratio (proba / threshold).
    l1_ratio = scored.l1_proba[eff] / max(scored.l1_threshold, 1e-9)
    l2_ratio = scored.l2_proba[eff] / max(scored.l2_threshold_calibrated, 1e-9)
    if l1_ratio >= l2_ratio:
        dominant = "L1"
        model_key, model_version = "texbat", scored.l1_model_version
        x_row = scored.l1_X[eff]
        feat_names = scored.l1_feature_names or []
        proba = float(scored.l1_proba[eff])
        threshold = float(scored.l1_threshold)
        ratio = float(l1_ratio)
    else:
        dominant = "L2"
        model_key, model_version = "aissou", scored.l2_model_version
        x_row = scored.l2_X[eff]
        feat_names = scored.l2_feature_names or []
        proba = float(scored.l2_proba[eff])
        threshold = float(scored.l2_threshold_calibrated)
        ratio = float(l2_ratio)

    shap_row, base_value = _shap_for_row(model_key, x_row)
    top = _top_features(feat_names, x_row, shap_row, TOP_K)

    sum_pos = float(sum(f["contribution"] for f in top if f["contribution"] > 0))
    sum_neg = float(sum(f["contribution"] for f in top if f["contribution"] < 0))

    return {
        "status": "ok",
        "tick_id": tick_id,
        "scenario_id": scenario_id,
        "tick": eff,
        "dominant_layer": dominant,
        "model_version": model_version,
        "model_versions": [scored.l1_model_version, scored.l2_model_version],
        "predicted_proba": proba,
        "threshold": threshold,
        "ratio": ratio,
        "base_value": base_value,
        "top_features": top,
        "shap_summary": {
            "sum_positive": sum_pos,
            "sum_negative": sum_neg,
            "n_features_total": len(feat_names),
        },
    }
