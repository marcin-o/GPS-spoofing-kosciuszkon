"""/ws/onboard — single-aircraft replay scored against ML-team's TEXBAT + Aissou."""
from __future__ import annotations

import asyncio
import logging
import time

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services import alert_mapper, replay_engine

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_payload(scenario_id: str, monotonic_tick: int) -> dict:
    raw, scored, eff = replay_engine.onboard_tick(scenario_id, monotonic_tick)

    l1_proba = scored.l1_proba[eff]
    l1_thr   = scored.l1_threshold
    l2_proba = scored.l2_proba[eff]
    l2_thr   = scored.l2_threshold_calibrated

    # ratio = proba / threshold; threshold = "bar at which the ML-team's
    # decision flips". <1 → OK, ≥1 → WARNING, ≥1.5 → CRITICAL.
    l1_ratio = float(l1_proba / l1_thr) if l1_thr > 0 else 0.0
    l2_ratio = float(l2_proba / l2_thr) if l2_thr > 0 else 0.0

    scores = {
        "L1": {
            "ratio": round(l1_ratio, 3),
            "threshold": l1_thr,
            "raw": round(l1_proba, 4),
            "model_version": scored.l1_model_version,
        },
        "L2": {
            "ratio": round(l2_ratio, 3),
            "threshold": l2_thr,
            "raw": round(l2_proba, 4),
            "model_version": scored.l2_model_version,
        },
    }
    dom_layer = "L1" if l1_ratio >= l2_ratio else "L2"
    overall = max(l1_ratio, l2_ratio)
    verdict = alert_mapper.verdict_for(overall)
    reasons = alert_mapper.onboard_reasons(dom_layer, overall, raw)

    return {
        "t": int(time.time() * 1000),
        "tick": monotonic_tick,
        "effective_tick": eff,
        "callsign": str(raw.get("callsign", "LOT283")),
        "context": "onboard",
        "scenario_id": scenario_id,
        "position": {
            "lat": float(raw.get("lat", 0.0)),
            "lon": float(raw.get("lon", 0.0)),
            "alt": float(raw.get("alt", 0.0)),
            "heading": float(raw.get("heading", 0.0)),
        },
        "scores": scores,
        "verdict": verdict,
        "dominant_layer": dom_layer,
        "top_reasons": reasons,
        "inference_ms": {"xgboost": 0.0, "L1": 0.0, "L2": 0.0},  # pre-scored at connect
        "is_attack": int(raw.get("is_attack", 0)) == 1,
    }


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
    interval = max(0.05, 0.1 / max(0.1, speed))  # 100 ms default
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
