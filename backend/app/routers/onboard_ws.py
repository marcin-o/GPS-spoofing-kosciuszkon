"""/ws/onboard — single-aircraft replay scored against ML-team's TEXBAT + Aissou."""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services import payload_builder, replay_engine

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_payload(scenario_id: str, monotonic_tick: int) -> dict:
    return payload_builder.build_onboard_payload(scenario_id, monotonic_tick)


@router.websocket("/ws/onboard")
async def onboard_ws(
    websocket: WebSocket,
    scenario: str = Query("normal_waw_gdn"),
    speed: float = Query(1.0),
) -> None:
    await websocket.accept()
    meta = replay_engine.get_meta(scenario)
    if not meta or meta["mode"] != "onboard":
        await websocket.send_json({"error": "invalid scenario for onboard mode",
                                   "scenario_id": scenario})
        await websocket.close()
        return

    # Pre-score now so the first tick isn't 800 ms slower.
    try:
        replay_engine.onboard_tick(scenario, 0)
    except Exception as exc:
        logger.exception("pre-score failed for %s: %s", scenario, exc)
        await websocket.send_json({"error": f"pre-score failed: {exc}",
                                   "scenario_id": scenario})
        await websocket.close()
        return

    tick_idx = 0
    # 500 ms default (2 Hz). Real TEXBAT is 1 Hz — replay 2× wall-clock.
    # Lower than this just makes scoreboard numbers flicker without adding
    # information.
    interval = max(0.1, 0.5 / max(0.1, speed))
    try:
        while True:
            payload = _build_payload(scenario, tick_idx)
            await websocket.send_json(payload)
            tick_idx += 1
            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        logger.info("onboard ws disconnected (scenario=%s ticks=%d)", scenario, tick_idx)
    except Exception as exc:
        logger.exception("onboard ws error: %s", exc)
        try:
            await websocket.close()
        except Exception:
            pass
