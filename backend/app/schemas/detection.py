from typing import Optional

from pydantic import BaseModel


class TrajectoryPoint(BaseModel):
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    timestamp: Optional[int] = None


class DetectionRequest(BaseModel):
    aircraft_id: Optional[str] = None
    points: list[TrajectoryPoint] = []


class DetectionResponse(BaseModel):
    status: str
    risk_score: float
    detected_anomalies: list[str] = []
    summary: str
