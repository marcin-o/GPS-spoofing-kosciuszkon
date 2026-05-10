"""Shared payload builders for live WS and replay WS.

Both /ws/onboard, /ws/globe (live streaming) and /ws/replay/onboard,
/ws/replay/globe (burst replay) produce identical per-tick message shapes.
Centralise construction here to avoid drift between the two consumers.
"""
from __future__ import annotations

import time

from app.services import alert_mapper, replay_engine


def build_onboard_payload(scenario_id: str, monotonic_tick: int, *, force_tick: int | None = None) -> dict:
    """Build a single onboard tick payload.

    Args:
        scenario_id: scenario identifier.
        monotonic_tick: stored in the "tick" field (WS counter or row index).
        force_tick: if given, use this value as the CSV row index directly,
            bypassing inject fast-forward. Used by replay endpoints so that
            effective_tick == row index for every frame.
    """
    raw, scored, eff = replay_engine.onboard_tick(scenario_id, monotonic_tick)

    if force_tick is not None:
        n = scored.n_ticks
        eff = force_tick % n
        raw = replay_engine._load_raw(scenario_id)[eff]

    l1_proba = scored.l1_proba[eff]
    l1_thr   = scored.l1_threshold
    l2_proba = scored.l2_proba[eff]
    l2_thr   = scored.l2_threshold_calibrated

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
    overall   = max(l1_ratio, l2_ratio)
    verdict   = alert_mapper.verdict_for(overall)
    reasons   = alert_mapper.onboard_reasons(dom_layer, overall, raw)

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
        "inference_ms": {"xgboost": 0.0, "L1": 0.0, "L2": 0.0},
        "is_attack": int(raw.get("is_attack", 0)) == 1,
    }


def build_globe_payload(scenario_id: str, monotonic_tick: int, *, force_tick: int | None = None) -> dict:
    """Build a single globe tick payload.

    Args:
        scenario_id: scenario identifier.
        monotonic_tick: stored in the "tick" field.
        force_tick: if given, bypass inject fast-forward (for replay).
    """
    if force_tick is not None:
        scored = replay_engine.get_globe_scored_direct(scenario_id)
        n = scored.n_ticks
        eff = force_tick % n
        aircraft = scored.aircraft_per_tick[eff]
    else:
        aircraft, eff = replay_engine.globe_tick_batch(scenario_id, monotonic_tick)

    enriched = []
    for a in aircraft:
        sub_dom = a["dominant_submodel"]
        ratio   = a["ensemble_score"]["ratio"]
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
        "inference_ms": {"ensemble_per_100ac": 0.0, "total": 0.0},
    }
