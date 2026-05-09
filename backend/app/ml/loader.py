"""Lazy ML model loader.

Person C is expected to ship .pkl files into ../ml/models/ during the
hackathon. The backend MUST NOT crash at startup if those are missing —
load lazily and fall back to heuristics.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# MODEL_DIR can be overridden via env (defaults to ../ml/models relative to repo root).
_DEFAULT_MODELS_DIR = Path(__file__).resolve().parents[3] / "ml" / "models"
_MODELS_DIR = Path(os.environ.get("MODEL_DIR", str(_DEFAULT_MODELS_DIR))).resolve()

_cache: dict[str, Any] = {}
_missing_logged: set[str] = set()
_shap_explainer_cache: dict[str, Any] = {}

ONBOARD_DEFAULT_FEATURES: tuple[str, ...] = (
    "cn0_ch1",
    "doppler_ch1",
    "agc_level",
    "satellite_count",
    "carrier_phase_var",
)

CLASS_LABELS: tuple[str, ...] = ("clean", "meaconing", "sophisticated")


def models_dir() -> Path:
    return _MODELS_DIR


def model_path(name: str) -> Path:
    return _MODELS_DIR / name


def _load_pkl(name: str) -> Any | None:
    if name in _cache:
        return _cache[name]
    path = model_path(name)
    if not path.exists():
        if name not in _missing_logged:
            logger.warning(
                "ml model %s not found at %s — using heuristic fallback", name, path
            )
            _missing_logged.add(name)
        _cache[name] = None
        return None
    try:
        import joblib

        model = joblib.load(path)
        _cache[name] = model
        logger.info("loaded ml model %s", name)
        return model
    except Exception as exc:  # pragma: no cover — fallback path
        logger.warning("failed to load %s: %s — using heuristic fallback", name, exc)
        _cache[name] = None
        return None


def load_xgb_model() -> Any | None:
    """Lazy-load Person C's XGBoost classifier from MODEL_DIR/xgb.pkl."""
    return _load_pkl("xgb.pkl")


def load_isoforest_model() -> Any | None:
    """Lazy-load Person C's IsolationForest from MODEL_DIR/isoforest.pkl.

    Exposed so the network agent can import it without circular deps.
    """
    return _load_pkl("isoforest.pkl")


# Back-compat alias for code already calling get_isoforest().
def get_isoforest() -> Any | None:
    return load_isoforest_model()


def xgb_model_loaded() -> bool:
    """Whether xgb.pkl has been successfully loaded into the cache."""
    return _cache.get("xgb.pkl") is not None


def _heuristic_score(features: dict[str, Any]) -> float:
    """Mirror of the FE mock in frontend/mocks/handlers.ts. Keep in sync."""
    cn0 = float(features.get("cn0_ch1", 45))
    doppler = float(features.get("doppler_ch1", 1000))
    raw = (50.0 - cn0) / 30.0 + abs(doppler - 1500.0) / 4000.0
    return max(0.0, min(1.0, raw))


def _heuristic_shap(features: dict[str, Any]) -> list[dict[str, float | str]]:
    cn0 = float(features.get("cn0_ch1", 45))
    doppler = float(features.get("doppler_ch1", 1000))
    agc = float(features.get("agc_level", 0.4))
    sats = float(features.get("satellite_count", 8))
    cp_var = float(features.get("carrier_phase_var", 0.05))
    contribs = [
        {"feature": "cn0_ch1", "value": cn0, "contribution": -((50.0 - cn0) / 50.0)},
        {"feature": "doppler_ch1", "value": doppler, "contribution": abs(doppler - 1500.0) / 4000.0},
        {"feature": "agc_level", "value": agc, "contribution": 0.12},
        {"feature": "satellite_count", "value": sats, "contribution": -0.08},
        {"feature": "carrier_phase_var", "value": cp_var, "contribution": 0.06},
    ]
    contribs.sort(key=lambda c: abs(float(c["contribution"])), reverse=True)
    return contribs[:5]


def _classify(score: float, raw_class: str | None = None) -> str:
    if raw_class in CLASS_LABELS:
        return raw_class
    if score >= 0.85:
        return "sophisticated"
    if score >= 0.55:
        return "meaconing"
    return "clean"


def _model_feature_order(model: Any) -> list[str] | None:
    names = getattr(model, "feature_names_in_", None)
    if names is not None:
        return [str(n) for n in names]
    booster = getattr(model, "get_booster", None)
    if callable(booster):
        try:
            fn = booster().feature_names
            if fn:
                return [str(n) for n in fn]
        except Exception:  # pragma: no cover
            return None
    return None


def _build_feature_vector(
    model: Any, features: dict[str, Any]
) -> tuple[list[str], list[float]]:
    order = _model_feature_order(model) or list(ONBOARD_DEFAULT_FEATURES)
    vec: list[float] = []
    for name in order:
        try:
            vec.append(float(features.get(name, 0.0)))
        except (TypeError, ValueError):
            vec.append(0.0)
    return order, vec


def _get_shap_explainer(model: Any) -> Any | None:
    key = f"xgb::{id(model)}"
    if key in _shap_explainer_cache:
        return _shap_explainer_cache[key]
    try:
        import shap

        explainer = shap.TreeExplainer(model)
        _shap_explainer_cache[key] = explainer
        return explainer
    except Exception as exc:  # pragma: no cover
        logger.warning("shap.TreeExplainer init failed: %s", exc)
        _shap_explainer_cache[key] = None
        return None


def _shap_top5_from_model(
    model: Any,
    feature_names: list[str],
    feature_vec: list[float],
    predicted_class_idx: int,
) -> list[dict[str, float | str]] | None:
    explainer = _get_shap_explainer(model)
    if explainer is None:
        return None
    try:
        import numpy as np

        x = np.asarray([feature_vec], dtype=float)
        sv = explainer.shap_values(x)
        # Multi-class: list of arrays or 3D array; binary: 2D array.
        if isinstance(sv, list):
            arr = sv[predicted_class_idx] if predicted_class_idx < len(sv) else sv[-1]
            row = np.asarray(arr)[0]
        else:
            arr = np.asarray(sv)
            if arr.ndim == 3:
                row = arr[predicted_class_idx][0]
            else:
                row = arr[0]
        contribs = [
            {
                "feature": feature_names[i],
                "value": float(feature_vec[i]),
                "contribution": float(row[i]),
            }
            for i in range(min(len(feature_names), len(row)))
        ]
        contribs.sort(key=lambda c: abs(float(c["contribution"])), reverse=True)
        return contribs[:5]
    except Exception as exc:  # pragma: no cover
        logger.warning("shap inference failed: %s — falling back to heuristic shap", exc)
        return None


def run_onboard_inference(
    features: dict[str, Any],
) -> tuple[float, str, list[dict[str, float | str]]]:
    """Run on-board spoofing inference.

    Returns (score in [0,1], class label, top-5 SHAP contributions).
    Falls back to the FE-mock heuristic if xgb.pkl is missing.
    """
    model = load_xgb_model()
    if model is None:
        score = _heuristic_score(features)
        return score, _classify(score), _heuristic_shap(features)

    try:
        import numpy as np

        feature_names, feature_vec = _build_feature_vector(model, features)
        x = np.asarray([feature_vec], dtype=float)

        proba_fn = getattr(model, "predict_proba", None)
        if callable(proba_fn):
            proba = np.asarray(proba_fn(x))[0]
            class_idx = int(np.argmax(proba))
            classes = getattr(model, "classes_", None)
            raw_label = str(classes[class_idx]) if classes is not None else None
            if proba.shape[0] >= 4:
                # 4-class model from Person C: clean / meaconing / sophisticated / (extra).
                # Spoof probability = 1 - P(clean). Map by argmax label when known.
                clean_idx = 0
                if classes is not None:
                    for i, c in enumerate(classes):
                        if str(c).lower() == "clean":
                            clean_idx = i
                            break
                score = float(1.0 - proba[clean_idx])
            else:
                # Binary classifier: P(spoof).
                score = float(proba[-1])
            klass = _classify(score, raw_label)
        else:
            preds = np.asarray(model.predict(x))
            score = float(min(1.0, max(0.0, float(preds[0]))))
            class_idx = 0 if score < 0.55 else (1 if score < 0.85 else 2)
            klass = _classify(score)

        shap_top5 = _shap_top5_from_model(model, feature_names, feature_vec, class_idx)
        if shap_top5 is None:
            shap_top5 = _heuristic_shap(features)
        return score, klass, shap_top5
    except Exception as exc:
        logger.warning("xgb inference failed: %s — falling back to heuristic", exc)
        score = _heuristic_score(features)
        return score, _classify(score), _heuristic_shap(features)
