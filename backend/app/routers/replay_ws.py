"""/ws/replay/onboard and /ws/replay/globe — burst-send full scenario timeline.

Unlike the live streaming endpoints (/ws/onboard, /ws/globe) which drip-feed
one tick per interval, these endpoints pre-score the whole scenario (using the
same cached results) and send a single JSON message with all ticks, then close.

Message shape:
  {
    "kind": "replay_init",
    "scenario_id": str,
    "mode": "onboard" | "live_globe",
    "duration_s": float,
    "ticks": [ ...per-tick payloads... ]
  }

The frontend buffers the full list and drives its own scrubber loop locally —
no further server interaction needed while replaying.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services import payload_builder, replay_engine

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/replay/onboard")
async def replay_onboard(
    websocket: WebSocket,
    scenario: str = Query("normal_waw_gdn"),
) -> None:
    await websocket.accept()

    meta = replay_engine.get_meta(scenario)
    if not meta or meta["mode"] != "onboard":
        await websocket.send_json({
            "error": "invalid scenario for onboard replay",
            "scenario_id": scenario,
        })
        await websocket.close()
        return

    try:
        # Trigger pre-score (no-op if already cached).
        replay_engine.onboard_tick(scenario, 0)
    except Exception as exc:
        logger.exception("replay pre-score failed for %s: %s", scenario, exc)
        await websocket.send_json({"error": f"pre-score failed: {exc}", "scenario_id": scenario})
        await websocket.close()
        return

    scored = replay_engine.get_onboard_scored_direct(scenario)
    n = scored.n_ticks

    ticks = []
    for i in range(n):
        ticks.append(payload_builder.build_onboard_payload(scenario, i, force_tick=i))

    try:
        await websocket.send_json({
            "kind": "replay_init",
            "scenario_id": scenario,
            "mode": "onboard",
            "duration_s": float(meta.get("duration_s", n * 0.5)),
            "ticks": ticks,
        })
    except WebSocketDisconnect:
        logger.info("replay/onboard client disconnected before receiving (scenario=%s)", scenario)
        return

    try:
        await websocket.close()
    except Exception:
        pass
    logger.info("replay/onboard burst sent scenario=%s ticks=%d", scenario, n)


@router.websocket("/ws/replay/globe")
async def replay_globe(
    websocket: WebSocket,
    scenario: str = Query("baltic_teleport"),
) -> None:
    await websocket.accept()

    meta = replay_engine.get_meta(scenario)
    if not meta or meta["mode"] != "live_globe":
        await websocket.send_json({
            "error": "invalid scenario for globe replay",
            "scenario_id": scenario,
        })
        await websocket.close()
        return

    try:
        replay_engine.globe_tick_batch(scenario, 0)
    except Exception as exc:
        logger.exception("replay pre-score failed for %s: %s", scenario, exc)
        await websocket.send_json({"error": f"pre-score failed: {exc}", "scenario_id": scenario})
        await websocket.close()
        return

    scored = replay_engine.get_globe_scored_direct(scenario)
    n = scored.n_ticks

    ticks = []
    for i in range(n):
        ticks.append(payload_builder.build_globe_payload(scenario, i, force_tick=i))

    try:
        await websocket.send_json({
            "kind": "replay_init",
            "scenario_id": scenario,
            "mode": "live_globe",
            "duration_s": float(meta.get("duration_s", n * 1.5)),
            "ticks": ticks,
        })
    except WebSocketDisconnect:
        logger.info("replay/globe client disconnected before receiving (scenario=%s)", scenario)
        return

    try:
        await websocket.close()
    except Exception:
        pass
    logger.info("replay/globe burst sent scenario=%s ticks=%d", scenario, n)
