"""/ws/globe — fleet replay scored through ML-team's OpenSky ensemble.

Pre-scoring strategy: at WS connect we run the ML-team's batch scorers
(score_opensky, score_opensky_multitime, score_lstm_ae(dynamic)) for
every tick of the scenario. Per-tick streaming is then a cache lookup.
"""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services import payload_builder, replay_engine

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_payload(scenario_id: str, monotonic_tick: int) -> dict:
    return payload_builder.build_globe_payload(scenario_id, monotonic_tick)


@router.websocket("/ws/globe")
async def globe_ws(
    websocket: WebSocket,
    scenario: str = Query("baltic_teleport"),
    speed: float = Query(1.0),
) -> None:
    await websocket.accept()
    meta = replay_engine.get_meta(scenario)
    if not meta or meta["mode"] != "live_globe":
        await websocket.send_json({"error": "invalid scenario for live_globe mode",
                                   "scenario_id": scenario})
        await websocket.close()
        return

    # Pre-score whole scenario now (~5-15 s). The first send to the
    # client is a real batch — keeps the WS contract simple.
    try:
        replay_engine.globe_tick_batch(scenario, 0)
    except Exception as exc:
        logger.exception("pre-score failed for %s: %s", scenario, exc)
        await websocket.send_json({"error": f"pre-score failed: {exc}",
                                   "scenario_id": scenario})
        await websocket.close()
        return

    tick_idx = 0
    interval = max(0.2, 1.5 / max(0.1, speed))  # 1.5 s default
    try:
        while True:
            await websocket.send_json(_build_payload(scenario, tick_idx))
            tick_idx += 1
            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        logger.info("globe ws disconnected (scenario=%s ticks=%d)", scenario, tick_idx)
    except Exception as exc:
        logger.exception("globe ws error: %s", exc)
        try:
            await websocket.close()
        except Exception:
            pass
