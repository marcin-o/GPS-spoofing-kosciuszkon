from typing import Optional

from pydantic import BaseModel


class Aircraft(BaseModel):
    icao24: str
    callsign: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    velocity: Optional[float] = None
    heading: Optional[float] = None
    timestamp: Optional[int] = None


class LiveFlightsResponse(BaseModel):
    aircraft: list[Aircraft] = []
    source: str = "mock"
    cached: bool = False
