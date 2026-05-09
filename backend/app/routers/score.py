"""POST /api/score/onboard — on-board spoofing detector.

Real model: ml/models/xgb.pkl + shap.TreeExplainer.
Fallback: FE-mock heuristic when the .pkl is missing.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter

from app.ml.loader import run_onboard_inference
from app.schemas.onboard import (
    OnboardScoreRequest,
    OnboardScoreResponse,
    ShapContribution,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["score"])


@router.post(
    "/score/onboard",
    response_model=OnboardScoreResponse,
    response_model_by_alias=True,
)
def score_onboard(payload: OnboardScoreRequest) -> OnboardScoreResponse:
    score, klass, shap_top5 = run_onboard_inference(payload.features or {})
    return OnboardScoreResponse(
        score=round(score, 2),
        klass=klass,  # type: ignore[arg-type]
        shap=[ShapContribution(**c) for c in shap_top5],
    )
