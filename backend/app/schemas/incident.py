from typing import Literal

from pydantic import BaseModel

IncidentType = Literal["aviation", "maritime"]


class IncidentSummary(BaseModel):
    id: str
    title: str
    date: str
    type: IncidentType
    region: str
    summary: str


class ReplayFrame(BaseModel):
    ts: float
    lat_real: float
    lon_real: float
    lat_reported: float
    lon_reported: float
    score: float


class IncidentReplay(BaseModel):
    id: str
    title: str
    frames: list[ReplayFrame]
