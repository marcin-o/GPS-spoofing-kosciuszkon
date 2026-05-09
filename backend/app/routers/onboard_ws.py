"""/ws/onboard — single-aircraft replay with L1 (TEXBAT) + L2 (Aissou) scoring."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services import alert_mapper, ml_service, replay_engine
from ml.schemas import AISSOU_FEATURES, TEXBAT_FEATURES

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_payload(scenario_id: str, tick_idx: int, row: dict[str, Any]) -> dict[str, Any]:
    tx_payload = {f: float(row.get(f"tx_{f}", 0.0)) for f in TEXBAT_FEATURES}
    ai_payload = {f: float(row.get(f"ai_{f}", 0.0)) for f in AISSOU_FEATURES}

    t0 = time.perf_counter()
    l1 = ml_service.run("texbat", tx_payload)
    l2 = ml_service.run("aissou", ai_payload)
    total_ms = round((time.perf_counter() - t0) * 1000, 2)

    scores = {
        "L1": {
            "ratio": round(l1["ratio"], 3),
            "threshold": l1["threshold"],
            "raw": round(l1["raw"], 4),
            "model_version": l1["model_version"],
        },
        "L2": {
            "ratio": round(l2["ratio"], 3),
            "threshold": l2["threshold"],
            "raw": round(l2["raw"], 4),
            "model_version": l2["model_version"],
        },
    }
    dom_layer = alert_mapper.dominant_layer(scores)
    overall_ratio = max(scores["L1"]["ratio"], scores["L2"]["ratio"])
    verdict = alert_mapper.verdict_for(overall_ratio)
    reasons = alert_mapper.onboard_reasons(dom_layer, overall_ratio, row)

    return {
        "t": int(time.time() * 1000),
        "tick": tick_idx,
        "callsign": str(row.get("callsign", "LOT283")),
        "context": "onboard",
        "scenario_id": scenario_id,
        "position": {
            "lat": float(row.get("lat", 0.0)),
            "lon": float(row.get("lon", 0.0)),
            "alt": float(row.get("alt", 0.0)),
            "heading": float(row.get("heading", 0.0)),
        },
        "scores": scores,
        "verdict": verdict,
        "dominant_layer": dom_layer,
        "top_reasons": reasons,
        "inference_ms": {
            "xgboost": total_ms,
            "L1": l1["inference_ms"],
            "L2": l2["inference_ms"],
        },
        "is_attack": int(row.get("is_attack", 0)) == 1,
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

    tick_idx = 0
    interval = max(0.05, 0.1 / max(0.1, speed))  # 100 ms default
    try:
        while True:
            row = replay_engine.onboard_tick(scenario, tick_idx)
            payload = _build_payload(scenario, tick_idx, row)
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
