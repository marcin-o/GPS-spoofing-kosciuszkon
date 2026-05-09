"""/ws/globe — fleet-wide replay scored through opensky_ensemble."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services import alert_mapper, ml_service, replay_engine
from ml.schemas import OPENSKY_FEATURES

logger = logging.getLogger(__name__)
router = APIRouter()


def _score_aircraft(row: dict[str, Any]) -> dict[str, Any]:
    payload = {f: float(row.get(f"f_{f}", 0.0)) for f in OPENSKY_FEATURES}
    payload["trajectory"] = replay_engine.trajectory_from_row(row)

    res = ml_service.run("opensky_ensemble", payload)
    sub = res["sub_scores"]
    # Clip ratios for display (LSTM-AE on synthetic data can hit huge values).
    def _cap(r: float, ceiling: float = 4.0) -> float:
        return min(ceiling, r)

    return {
        "icao24": str(row.get("icao24")),
        "callsign": str(row.get("callsign")),
        "origin_country": str(row.get("origin_country")),
        "position": {
            "lat": float(row.get("lat", 0.0)),
            "lon": float(row.get("lon", 0.0)),
            "alt": float(row.get("alt", 0.0)),
            "velocity": float(row.get("velocity", 0.0)),
            "true_track": float(row.get("true_track", 0.0)),
            "vertical_rate": float(row.get("vertical_rate", 0.0)),
            "on_ground": int(row.get("on_ground", 0)) == 1,
        },
        "ensemble_score": {
            "ratio": round(_cap(res["ratio"]), 3),
            "threshold": res["threshold"],
        },
        "sub_scores": {
            "iforest_v1": {"ratio": round(_cap(sub["iforest_v1"]["ratio"]), 3)},
            "iforest_v2": {"ratio": round(_cap(sub["iforest_v2"]["ratio"]), 3)},
            "lstm_ae":    {"ratio": round(_cap(sub["lstm_ae"]["ratio"]), 3)},
        },
        "dominant_submodel": res["dominant_submodel"],
        "verdict": alert_mapper.verdict_for(_cap(res["ratio"])),
        "last_contact": int(time.time() * 1000),
        "is_anomaly": int(row.get("is_anomaly", 0)) == 1,
        "top_reasons": alert_mapper.globe_reasons(
            res["dominant_submodel"], _cap(res["ratio"]), row,
        ),
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

    tick_idx = 0
    interval = max(0.2, 1.5 / max(0.1, speed))  # 1.5s default
    try:
        while True:
            t0 = time.perf_counter()
            batch = replay_engine.globe_tick_batch(scenario, tick_idx)
            scored = [_score_aircraft(r) for r in batch]
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
            payload = {
                "t": int(time.time() * 1000),
                "tick": tick_idx,
                "context": "live_globe",
                "scenario_id": scenario,
                "aircraft": scored,
                "inference_ms": {
                    "ensemble_per_100ac": round(
                        elapsed_ms / max(1, len(scored)) * 100, 2
                    ),
                    "total": elapsed_ms,
                },
            }
            await websocket.send_json(payload)
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
