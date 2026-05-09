"""AISStream WebSocket bridge.

Buffers latest position per MMSI in memory; the HTTP route reads the
buffer. If AISSTREAM_API_KEY is missing, the pump is never started and
callers get an empty buffer (route then falls back to fixtures).
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

_AIS_WS_URL = "wss://stream.aisstream.io/v0/stream"

_buffer: dict[str, dict[str, Any]] = {}
_task: asyncio.Task[None] | None = None


def latest_positions() -> list[dict[str, Any]]:
    return list(_buffer.values())


def _store(msg: dict[str, Any]) -> None:
    meta = msg.get("MetaData") or {}
    body = msg.get("Message", {}).get("PositionReport") or msg.get("Message", {}).get(
        "ShipStaticData"
    )
    if not body:
        return
    mmsi = str(meta.get("MMSI") or body.get("UserID") or "")
    if not mmsi:
        return
    lat = meta.get("latitude") or body.get("Latitude")
    lon = meta.get("longitude") or body.get("Longitude")
    if lat is None or lon is None:
        return
    existing = _buffer.get(mmsi, {})
    existing.update(
        {
            "mmsi": mmsi,
            "name": meta.get("ShipName") or existing.get("name"),
            "lat": float(lat),
            "lon": float(lon),
            "sog": float(body.get("Sog") or existing.get("sog") or 0.0),
            "cog": float(body.get("Cog") or existing.get("cog") or 0.0),
            "ts": time.time(),
        }
    )
    _buffer[mmsi] = existing


async def _pump() -> None:  # pragma: no cover — network loop
    import websockets  # imported lazily

    sub = json.dumps(
        {
            "APIKey": settings.aisstream_api_key,
            "BoundingBoxes": [[[-90, -180], [90, 180]]],
        }
    )
    backoff = 1.0
    while True:
        try:
            async with websockets.connect(_AIS_WS_URL, ping_interval=30) as ws:
                await ws.send(sub)
                backoff = 1.0
                async for raw in ws:
                    try:
                        _store(json.loads(raw))
                    except Exception as exc:
                        logger.debug("ais parse error: %s", exc)
        except Exception as exc:
            logger.warning("aisstream connection lost: %s — retry in %.1fs", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(60.0, backoff * 2)


def start() -> None:
    global _task
    if _task is not None or not settings.aisstream_api_key:
        return
    loop = asyncio.get_event_loop()
    _task = loop.create_task(_pump())
    logger.info("AISStream pump started")


def stop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        _task = None
