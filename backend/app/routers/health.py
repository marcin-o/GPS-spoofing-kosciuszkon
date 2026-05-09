from fastapi import APIRouter

from app.ml.loader import load_xgb_model
from app.services import ml_service

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> dict[str, object]:
    latency = ml_service.latency()
    return {
        "status": "ok",
        "service": "gnss-defense-monitor-backend",
        "model_loaded": True,
        "legacy_xgb_loaded": load_xgb_model() is not None,
        # Versions and F1 reflect the ML-team's bundle metadata.
        "model_versions": [
            {"layer": "L1", "scenario": "texbat",
             "version": "texbat-xgb-v1", "f1": 0.984},
            {"layer": "L2", "scenario": "aissou",
             "version": "aissou-xgb-binary-v1", "f1": 0.976},
            {"layer": "L3-iforest-v1", "scenario": "opensky",
             "version": "opensky-iforest-v1", "f1": 0.789},
            {"layer": "L3-iforest-v2", "scenario": "opensky",
             "version": "opensky-iforest-multitime-v2", "f1": 0.743},
            {"layer": "L3-lstm-ae", "scenario": "opensky",
             "version": "lstm-ae-trajectories-v1", "f1": 0.935},
            {"layer": "L3-ensemble", "scenario": "opensky_ensemble",
             "version": "opensky-ensemble-v1", "f1": 0.935},
        ],
        "inference_latency_ms": latency,
    }
