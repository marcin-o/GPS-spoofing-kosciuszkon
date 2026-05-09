from __future__ import annotations

import json
import random
from typing import TypedDict

from fastapi import APIRouter, HTTPException

from app.schemas.incident import IncidentReplay, IncidentSummary, ReplayFrame
from app.services.data_loader import incidents_fixture, trajectory_file

router = APIRouter(prefix="/incidents", tags=["incidents"])


class _ReplaySpec(TypedDict):
    start: tuple[float, float]
    drift: tuple[float, float]
    count: int


_REPLAY_SPECS: dict[str, _ReplaySpec] = {
    "flight-8243": {"start": (43.32, 45.7), "drift": (1.4, 4.2), "count": 144},
    "hormuz-2025": {"start": (26.7, 56.3), "drift": (-0.05, -0.18), "count": 96},
    "beirut-2024": {"start": (33.93, 35.49), "drift": (0.04, -0.07), "count": 72},
}


def _build_frames(start: tuple[float, float], drift: tuple[float, float], count: int) -> list[ReplayFrame]:
    frames: list[ReplayFrame] = []
    rng = random.Random(start[0] + start[1] + count)  # stable per-incident jitter
    for i in range(count):
        t = i / (count - 1) if count > 1 else 0.0
        lat_real = start[0] + drift[0] * t * 0.6
        lon_real = start[1] + drift[1] * t * 0.6
        d = max(0.0, t - 0.25)
        lat_reported = lat_real + d * drift[0] * 1.4
        lon_reported = lon_real + d * drift[1] * 1.4
        score = 0.05 + rng.random() * 0.05 if d == 0 else min(0.97, 0.3 + d * 1.4)
        frames.append(
            ReplayFrame(
                ts=i * 5,
                lat_real=lat_real,
                lon_real=lon_real,
                lat_reported=lat_reported,
                lon_reported=lon_reported,
                score=round(score, 2),
            )
        )
    return frames


@router.get("", response_model=list[IncidentSummary])
def list_incidents() -> list[IncidentSummary]:
    return [IncidentSummary(**i) for i in incidents_fixture()]


@router.get("/{incident_id}/replay", response_model=IncidentReplay)
def get_replay(incident_id: str) -> IncidentReplay:
    summary = next((i for i in incidents_fixture() if i["id"] == incident_id), None)
    if summary is None:
        raise HTTPException(status_code=404, detail=f"unknown incident '{incident_id}'")

    path = trajectory_file(incident_id)
    if path.exists():
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        return IncidentReplay(
            id=incident_id,
            title=payload.get("title", summary["title"]),
            frames=[ReplayFrame(**fr) for fr in payload["frames"]],
        )

    spec = _REPLAY_SPECS.get(incident_id)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"no replay spec for '{incident_id}'")
    return IncidentReplay(
        id=incident_id,
        title=summary["title"],
        frames=_build_frames(spec["start"], spec["drift"], spec["count"]),
    )
