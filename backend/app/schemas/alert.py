from typing import Literal, Optional

from pydantic import BaseModel


class BboxCenter(BaseModel):
    lat: float
    lon: float


class AlertEvent(BaseModel):
    id: str
    type: Literal["aircraft", "ship"]
    aircraft_id: Optional[str] = None
    mmsi: Optional[str] = None
    score: float
    ts: float
    bbox_center: BboxCenter
