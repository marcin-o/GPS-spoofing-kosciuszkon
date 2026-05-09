from fastapi import APIRouter

from app.schemas.detection import DetectionRequest, DetectionResponse

router = APIRouter(prefix="/detection", tags=["detection"])


@router.post("/trajectory", response_model=DetectionResponse)
def detect_trajectory(payload: DetectionRequest):
    return DetectionResponse(
        status="normal",
        risk_score=0.0,
        detected_anomalies=[],
        summary="No anomaly detected.",
    )
