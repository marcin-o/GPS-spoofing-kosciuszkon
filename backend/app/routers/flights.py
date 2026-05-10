from __future__ import annotations

import logging
import random
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.schemas.flight import Flight
from app.services import live_replay, opensky
from app.services.data_loader import flights_fixture
from app.services.scoring import (
    heuristic_features,
    heuristic_score,
    level_for,
    reasons_for,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/flights", tags=["flights"])

_prev_state: dict[str, dict[str, float]] = {}


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


def _score_flight(state: dict[str, Any]) -> Flight:
    icao = state["icao24"]
    lat = float(state["latitude"])
    lon = float(state["longitude"])
    alt = state.get("baro_altitude") or state.get("geo_altitude") or 0.0
    vel_mps = state.get("velocity") or 0.0
    vel_kt = float(vel_mps) * 1.94384
    heading = float(state.get("true_track") or 0.0)
    nic = 8 if not state.get("on_ground") else 6
    ts = float(state.get("time_position") or state.get("last_contact") or time.time())
    prev = _prev_state.get(icao)
    feats = heuristic_features(
        prev_lat=prev["lat"] if prev else None,
        prev_lon=prev["lon"] if prev else None,
        prev_ts=prev["ts"] if prev else None,
        lat=lat,
        lon=lon,
        ts=ts,
        vel_kt=vel_kt,
        heading=heading,
        nic=nic,
    )
    score = heuristic_score(feats)
    _prev_state[icao] = {"lat": lat, "lon": lon, "ts": ts}
    level = level_for(score)
    return Flight(
        icao24=icao,
        callsign=state.get("callsign"),
        lat=lat,
        lon=lon,
        alt_m=float(alt),
        vel_kt=round(vel_kt, 1),
        heading=heading,
        nic=nic,
        spoofing_score=round(score, 2),
        alert_level=level,
        reasons=reasons_for(score, nic_drop=feats["nic_drop"] >= 0.5),
    )


def _jitter_fixture(items: list[dict[str, Any]]) -> list[Flight]:
    out: list[Flight] = []
    for f in items:
        s = f["spoofing_score"] + (random.random() - 0.5) * 0.04
        s = max(0.0, min(1.0, s))
        out.append(
            Flight(
                icao24=f["icao24"],
                callsign=f.get("callsign"),
                lat=f["lat"] + (random.random() - 0.5) * 0.05,
                lon=f["lon"] + (random.random() - 0.5) * 0.05,
                alt_m=f["alt_m"],
                vel_kt=f["vel_kt"],
                heading=f["heading"],
                nic=f["nic"],
                spoofing_score=round(s, 2),
                alert_level=level_for(s),
                reasons=f.get("reasons", []),
            )
        )
    return out


@router.get("/live", response_model=list[Flight])
async def live_flights(bbox: str | None = Query(default=None)) -> list[Flight]:
    parsed = _parse_bbox(bbox)

    states = await opensky.fetch_states(parsed)
    if states:
        return [_score_flight(s) for s in states if s.get("latitude") and s.get("longitude")]

    if live_replay.is_available():
        replay_states = live_replay.snapshot_in_bbox(parsed)
        return [_score_flight(s) for s in replay_states if s.get("latitude") and s.get("longitude")]

    fixture = [f for f in flights_fixture() if _within(f["lat"], f["lon"], parsed)]
    return _jitter_fixture(fixture)


@router.get("/replay_status")
async def replay_status() -> dict[str, Any]:
    """Diagnostic endpoint — exposes current snapshot index + total snapshots."""
    return {
        "available": live_replay.is_available(),
        "n_snapshots": live_replay.n_snapshots(),
        "current_idx": live_replay.current_idx(),
        "tick_interval_s": live_replay.TICK_INTERVAL_S,
    }
