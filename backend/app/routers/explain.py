"""GET /api/explain/{tick_id} — honest 'pending' SHAP placeholder.

Per spec: this endpoint MUST NOT fake SHAP values. It returns a
structured pending response so the frontend can render an empty
'integration in progress' state without surprises.
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/explain", tags=["explain"])


@router.get("/{tick_id}")
def explain(tick_id: str) -> dict[str, object]:
    return {
        "status": "pending",
        "tick_id": tick_id,
        "message": "SHAP TreeExplainer integration in progress",
        "placeholder_features": [
            {"feature": "cn0_std", "value": None, "contribution": None},
            {"feature": "agc_mean", "value": None, "contribution": None},
            {"feature": "pseudorange_residual_mean", "value": None,
             "contribution": None},
            {"feature": "doppler_residual", "value": None, "contribution": None},
            {"feature": "multipath_indicator", "value": None, "contribution": None},
        ],
        "model_versions": ["texbat-xgb-v1", "aissou-xgb-bin-v1"],
    }
