from typing import Optional

from pydantic import BaseModel


class Alert(BaseModel):
    id: str
    aircraft_id: Optional[str] = None
    type: Optional[str] = None
    severity: Optional[str] = None
    message: Optional[str] = None
    timestamp: Optional[int] = None


class AlertsResponse(BaseModel):
    alerts: list[Alert] = []
