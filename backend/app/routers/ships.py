from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.schemas.ship import Ship
from app.services import aisstream
from app.services.data_loader import ships_fixture
from app.services.scoring import level_for

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ships", tags=["ships"])


def _parse_bbox(bbox: str | None) -> tuple[float, float, float, float] | None:
    if not bbox:
        return None
    parts = bbox.split(",")
    if len(parts) != 4:
        raise HTTPException(status_code=400, detail="bbox must be 'lat1,lon1,lat2,lon2'")
    try:
        lat1, lon1, lat2, lon2 = (float(p) for p in parts)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="bbox values must be numeric") from exc
    return min(lat1, lat2), min(lon1, lon2), max(lat1, lat2), max(lon1, lon2)


def _within(lat: float, lon: float, bbox: tuple[float, float, float, float] | None) -> bool:
    if bbox is None:
        return True
    lamin, lomin, lamax, lomax = bbox
    return lamin <= lat <= lamax and lomin <= lon <= lomax


def _score_live(p: dict[str, Any]) -> Ship:
    sog = float(p.get("sog") or 0.0)
    static_at_sea = sog < 0.2
    score = 0.78 if static_at_sea else 0.15
    reasons = ["GNSS jamming pattern", "static at sea"] if static_at_sea else []
    return Ship(
        mmsi=str(p["mmsi"]),
        name=p.get("name"),
        lat=float(p["lat"]),
        lon=float(p["lon"]),
        sog=sog,
        cog=float(p.get("cog") or 0.0),
        spoofing_score=score,
        alert_level=level_for(score),
        reasons=reasons,
    )


@router.get("/live", response_model=list[Ship])
async def live_ships(bbox: str | None = Query(default=None)) -> list[Ship]:
    parsed = _parse_bbox(bbox)
    live = aisstream.latest_positions()
    if live:
        return [_score_live(p) for p in live if _within(p["lat"], p["lon"], parsed)]
    return [Ship(**s) for s in ships_fixture() if _within(s["lat"], s["lon"], parsed)]
