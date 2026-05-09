"""/ws/globe — fleet replay scored through ML-team's OpenSky ensemble.

Pre-scoring strategy: at WS connect we run the ML-team's batch scorers
(score_opensky, score_opensky_multitime, score_lstm_ae(dynamic)) for
every tick of the scenario. Per-tick streaming is then a cache lookup.
"""
from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services import alert_mapper, replay_engine

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_payload(scenario_id: str, monotonic_tick: int) -> dict:
    aircraft, eff = replay_engine.globe_tick_batch(scenario_id, monotonic_tick)
    enriched = []
    for a in aircraft:
        sub_dom = a["dominant_submodel"]
        ratio = a["ensemble_score"]["ratio"]
        enriched.append({
            **a,
            "last_contact": int(time.time() * 1000),
            "top_reasons": alert_mapper.globe_reasons(sub_dom, ratio, {}),
        })
    return {
        "t": int(time.time() * 1000),
        "tick": monotonic_tick,
        "effective_tick": eff,
        "context": "live_globe",
        "scenario_id": scenario_id,
        "aircraft": enriched,
        "inference_ms": {"ensemble_per_100ac": 0.0, "total": 0.0},  # pre-scored
    }


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
