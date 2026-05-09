from fastapi import APIRouter

from app.ml.loader import load_xgb_model

router = APIRouter(tags=["health"])


@router.get("/health")
def get_health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "gps-spoofing-sentinel-backend",
        "model_loaded": load_xgb_model() is not None,
    }
