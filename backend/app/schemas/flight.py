from typing import Literal, Optional

from pydantic import BaseModel

AlertLevel = Literal["ok", "warn", "critical"]


class Flight(BaseModel):
    icao24: str
    callsign: Optional[str] = None
    lat: float
    lon: float
    alt_m: float
    vel_kt: float
    heading: float
    nic: int
    spoofing_score: float
    alert_level: AlertLevel
    reasons: list[str] = []
