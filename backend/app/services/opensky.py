"""OpenSky Network client (OAuth2 client_credentials, 15s in-process cache)."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_CACHE_TTL = 15.0
_TOKEN_LEEWAY = 30.0

_token: dict[str, Any] = {"value": None, "exp": 0.0}
_states_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_lock = asyncio.Lock()


async def _get_token(client: httpx.AsyncClient) -> str | None:
    if not settings.opensky_client_id or not settings.opensky_client_secret:
        return None
    now = time.time()
    if _token["value"] and now < _token["exp"] - _TOKEN_LEEWAY:
        return _token["value"]
    resp = await client.post(
        settings.opensky_token_url,
        data={
            "grant_type": "client_credentials",
            "client_id": settings.opensky_client_id,
            "client_secret": settings.opensky_client_secret,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10.0,
    )
    resp.raise_for_status()
    payload = resp.json()
    _token["value"] = payload["access_token"]
    _token["exp"] = now + float(payload.get("expires_in", 1800))
    return _token["value"]


def _bbox_key(bbox: tuple[float, float, float, float] | None) -> str:
    return "all" if bbox is None else ",".join(f"{v:.3f}" for v in bbox)


async def fetch_states(
    bbox: tuple[float, float, float, float] | None = None,
) -> list[dict[str, Any]] | None:
    """Return raw OpenSky state vectors as a list of dicts.

    Returns None when credentials are missing or the upstream call fails;
    the caller should fall back to fixtures.
    """
    if not settings.opensky_client_id or not settings.opensky_client_secret:
        return None

    cache_key = _bbox_key(bbox)
    now = time.time()
    cached = _states_cache.get(cache_key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    async with _lock:
        cached = _states_cache.get(cache_key)
        if cached and now - cached[0] < _CACHE_TTL:
            return cached[1]
        try:
            async with httpx.AsyncClient() as client:
                token = await _get_token(client)
                if not token:
                    return None
                params: dict[str, Any] = {}
                if bbox is not None:
                    lamin, lomin, lamax, lomax = bbox
                    params.update(
                        {"lamin": lamin, "lomin": lomin, "lamax": lamax, "lomax": lomax}
                    )
                resp = await client.get(
                    settings.opensky_states_url,
                    params=params,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=15.0,
                )
                resp.raise_for_status()
                payload = resp.json()
                states = payload.get("states") or []
                parsed = [_parse_state(s) for s in states if s and s[0]]
                _states_cache[cache_key] = (time.time(), parsed)
                return parsed
        except Exception as exc:
            logger.warning("OpenSky fetch failed: %s — falling back to fixture", exc)
            return None


_FIELDS = [
    "icao24",
    "callsign",
    "origin_country",
    "time_position",
    "last_contact",
    "longitude",
    "latitude",
    "baro_altitude",
    "on_ground",
    "velocity",
    "true_track",
    "vertical_rate",
    "sensors",
    "geo_altitude",
    "squawk",
    "spi",
    "position_source",
]


def _parse_state(state: list[Any]) -> dict[str, Any]:
    out: dict[str, Any] = {k: state[i] if i < len(state) else None for i, k in enumerate(_FIELDS)}
    if isinstance(out.get("callsign"), str):
        out["callsign"] = out["callsign"].strip() or None
    return out
