from typing import Optional

from pydantic import BaseModel

from app.schemas.flight import AlertLevel


class Ship(BaseModel):
    mmsi: str
    name: Optional[str] = None
    lat: float
    lon: float
    sog: float
    cog: float
    spoofing_score: float
    alert_level: AlertLevel
    reasons: list[str] = []
