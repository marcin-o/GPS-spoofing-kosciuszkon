from typing import Optional

from pydantic import BaseModel


class TrajectoryPoint(BaseModel):
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    timestamp: Optional[int] = None


class Incident(BaseModel):
    id: str
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    timestamp: Optional[int] = None


class IncidentsResponse(BaseModel):
    incidents: list[Incident] = []


class IncidentTrajectoryResponse(BaseModel):
    incident_id: str
    points: list[TrajectoryPoint] = []
