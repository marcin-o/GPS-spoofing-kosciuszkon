from __future__ import annotations

import logging

from fastapi import APIRouter

from app.schemas.explain import ExplainResponse, FeatureContribution
from app.services.data_loader import flights_fixture

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/explain", tags=["explain"])

_TOP_FEATURE_NAMES = (
    "Δposition_3σ",
    "NIC_drop",
    "velocity_inconsistency",
    "trajectory_smoothness",
    "heading_chatter",
)

_HEURISTIC_WEIGHTS = (0.42, 0.31, 0.18, 0.06, 0.03)
_HEURISTIC_VALUES = (1.0, 1.0, 0.7, 0.45, 0.2)

_CRITICAL_NARRATIVE = (
    "Aircraft reported a sudden 4.2km position jump while NIC dropped from 8 to 0. "
    "Velocity vector inconsistent with heading. High likelihood of GPS spoofing."
)
_BENIGN_NARRATIVE = "Trajectory mildly noisy but within tolerance. No corroborating signals."

_cache: dict[str, ExplainResponse] = {}


def _heuristic_explain(aircraft_id: str, alert_level: str) -> ExplainResponse:
    top_features = [
        FeatureContribution(feature=name, value=val, contribution=contrib)
        for name, val, contrib in zip(
            _TOP_FEATURE_NAMES, _HEURISTIC_VALUES, _HEURISTIC_WEIGHTS
        )
    ]
    narrative = _CRITICAL_NARRATIVE if alert_level == "critical" else _BENIGN_NARRATIVE
    return ExplainResponse(
        aircraft_id=aircraft_id,
        top_features=top_features,
        plain_english=narrative,
    )


def _try_real_shap(aircraft_id: str) -> ExplainResponse | None:
    try:
        from app.ml.loader import get_isoforest
    except Exception:
        return None
    model = get_isoforest()
    if model is None:
        return None
    # A real IsolationForest doesn't have native SHAP; if Person C ships
    # a wrapper exposing top-5 contributions, we use it. Otherwise the
    # heuristic path covers the same feature names so the FE renders
    # identically.
    explain_fn = getattr(model, "explain_top5", None)
    if not callable(explain_fn):
        return None
    try:
        contribs = explain_fn(aircraft_id)
        top_features = [FeatureContribution(**c) for c in contribs[:5]]
    except Exception as exc:  # pragma: no cover
        logger.warning("isoforest.explain_top5 failed: %s — using heuristic", exc)
        return None
    return ExplainResponse(
        aircraft_id=aircraft_id,
        top_features=top_features,
        plain_english=_CRITICAL_NARRATIVE,
    )


@router.get("/{aircraft_id}", response_model=ExplainResponse)
def explain(aircraft_id: str) -> ExplainResponse:
    cached = _cache.get(aircraft_id)
    if cached is not None:
        return cached

    real = _try_real_shap(aircraft_id)
    if real is not None:
        _cache[aircraft_id] = real
        return real

    target = next(
        (f for f in flights_fixture() if f["icao24"] == aircraft_id),
        flights_fixture()[0],
    )
    out = _heuristic_explain(aircraft_id, target.get("alert_level", "ok"))
    _cache[aircraft_id] = out
    return out
