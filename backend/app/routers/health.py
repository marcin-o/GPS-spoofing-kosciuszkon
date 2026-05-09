from fastapi import APIRouter

from app.ml.loader import load_xgb_model
from app.services import ml_service
from ml.schemas import F1_SCORES, MODEL_VERSIONS

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> dict[str, object]:
    latency = ml_service.latency()
    return {
        "status": "ok",
        "service": "gnss-defense-monitor-backend",
        "model_loaded": True,
        "legacy_xgb_loaded": load_xgb_model() is not None,
        "model_versions": [
            {"layer": "L1", "scenario": "texbat",
             "version": MODEL_VERSIONS["texbat"], "f1": F1_SCORES["texbat"]},
            {"layer": "L2", "scenario": "aissou",
             "version": MODEL_VERSIONS["aissou"], "f1": F1_SCORES["aissou"]},
            {"layer": "L3-iforest-v1", "scenario": "opensky",
             "version": MODEL_VERSIONS["iforest_v1"], "f1": F1_SCORES["iforest_v1"]},
            {"layer": "L3-iforest-v2", "scenario": "opensky",
             "version": MODEL_VERSIONS["iforest_v2"], "f1": F1_SCORES["iforest_v2"]},
            {"layer": "L3-lstm-ae", "scenario": "opensky",
             "version": MODEL_VERSIONS["lstm_ae"], "f1": F1_SCORES["lstm_ae"]},
            {"layer": "L3-ensemble", "scenario": "opensky_ensemble",
             "version": MODEL_VERSIONS["opensky_ensemble"],
             "f1": F1_SCORES["opensky_ensemble"]},
        ],
        "inference_latency_ms": latency,
    }
