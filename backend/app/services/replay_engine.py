"""Scenario replay engine.

Each scenario CSV is pre-scored once (lazy on first reference) by
``ml_service.get_*_scored``, then ticks are streamed from the cached
result. The engine exposes:

  - ``onboard_tick(scenario_id, tick_idx)`` → ``(raw_row, scored_tick)``
  - ``globe_tick_batch(scenario_id, tick_idx)`` → ``list[scored_aircraft]``
  - ``inject(scenario_id)`` / ``reset(scenario_id)`` — fast-forward into
    the attack window.

Inject is implemented by mapping the WS handler's monotonic tick counter
through ``effective_tick(scenario_id, idx)`` so the next emitted tick
sits *after* the natural attack onset.
"""
from __future__ import annotations

import csv
import logging
import threading
from pathlib import Path
from typing import Any

from app.services import ml_service

logger = logging.getLogger(__name__)

SCENARIO_DIR = Path(__file__).resolve().parents[1] / "scenarios"


_raw_cache: dict[str, list[dict[str, Any]]] = {}
_inject_until: dict[str, int] = {}
_lock = threading.Lock()


SCENARIOS = [
    {
        "id": "normal_waw_gdn",
        "name": "Lot normalny: WAW → GDN",
        "mode": "onboard",
        "duration_s": 20.0,
        "expected_dominant_layer": None,
        "description": "Czyste odczyty na trasie Warszawa-Gdańsk. Verdict pozostaje OK.",
    },
    {
        "id": "texbat_spoof",
        "name": "TEXBAT spoofing (sygnał)",
        "mode": "onboard",
        "duration_s": 20.0,
        "expected_dominant_layer": "L1",
        "description": "Atak na warstwie sygnałowej: power up, sqm asym, position drift.",
    },
    {
        "id": "aissou_channel_attack",
        "name": "Atak kanałowy Aissou",
        "mode": "onboard",
        "duration_s": 20.0,
        "expected_dominant_layer": "L2",
        "description": "Anomalia per-kanał na PRN3 i PRN5 (Aissou L2).",
    },
    {
        "id": "baltic_teleport",
        "name": "Bałtyk: teleport",
        "mode": "live_globe",
        "duration_s": 90.0,
        "expected_dominant_layer": "ensemble",
        "description": "Flotylla nad Bałtykiem; dwa samoloty wykonują skok pozycji ~280 km.",
    },
    {
        "id": "smooth_drift_fleet",
        "name": "Płynny drift (live)",
        "mode": "live_globe",
        "duration_s": 90.0,
        "expected_dominant_layer": "ensemble",
        "description": "Wolny, ciągły drift dwóch samolotów — wykrywany przez LSTM-AE (dynamic).",
    },
]

ID_TO_META = {s["id"]: s for s in SCENARIOS}


def list_scenarios() -> list[dict]:
    return [{k: v for k, v in s.items()} for s in SCENARIOS]


def get_meta(scenario_id: str) -> dict | None:
    return ID_TO_META.get(scenario_id)


def _csv_path(scenario_id: str) -> Path:
    return SCENARIO_DIR / f"{scenario_id}.csv"


def _load_raw(scenario_id: str) -> list[dict[str, Any]]:
    """Lazy-load CSV rows as Python dicts (numerics coerced)."""
    with _lock:
        if scenario_id in _raw_cache:
            return _raw_cache[scenario_id]
        path = _csv_path(scenario_id)
        if not path.exists():
            raise FileNotFoundError(f"scenario {scenario_id} not found at {path}")
        rows: list[dict[str, Any]] = []
        with path.open(newline="") as f:
            for r in csv.DictReader(f):
                conv: dict[str, Any] = {}
                for k, v in r.items():
                    if k in ("callsign", "icao24", "origin_country", "anomaly_kind"):
                        conv[k] = v
                    elif k == "on_ground":
                        conv[k] = (str(v).strip().lower() == "true")
                    else:
                        try:
                            conv[k] = float(v)
                        except (TypeError, ValueError):
                            conv[k] = v
                rows.append(conv)
        _raw_cache[scenario_id] = rows
        logger.info("loaded scenario rows %s: %d", scenario_id, len(rows))
        return rows


def effective_tick(scenario_id: str, tick_idx: int) -> int:
    """Apply inject fast-forward to a monotonic tick counter."""
    skip = _inject_until.get(scenario_id, 0)
    return max(tick_idx, skip)


# ─────────────────────────────────────────────────── onboard

def onboard_tick(scenario_id: str, tick_idx: int) -> tuple[dict, "ml_service.OnboardScored", int]:
    """Returns (raw_row, scored, effective_idx)."""
    rows = _load_raw(scenario_id)
    scored = ml_service.get_onboard_scored(scenario_id, _csv_path(scenario_id))
    n = len(rows)
    eff = effective_tick(scenario_id, tick_idx) % n
    return rows[eff], scored, eff


# ─────────────────────────────────────────────────── globe

def globe_tick_batch(scenario_id: str, tick_idx: int) -> tuple[list[dict], int]:
    """Returns (scored_aircraft_list, effective_idx)."""
    scored = ml_service.get_globe_scored(scenario_id, _csv_path(scenario_id))
    n = scored.n_ticks
    eff = effective_tick(scenario_id, tick_idx) % n
    return scored.aircraft_per_tick[eff], eff


# ─────────────────────────────────────────────────── inject

def inject(scenario_id: str) -> int:
    """Fast-forward subsequent ticks past the natural attack onset.

    Onboard CSVs: attack overlay starts at t=100, ramp to full intensity
    over ~30 ticks → jump to 110 so verdicts immediately reflect the attack.

    Globe CSVs: anomalies kick in at tick 8 (drift) or 12 (teleport) → jump
    to 14 so subsequent batches show post-anomaly state.
    """
    meta = get_meta(scenario_id)
    if meta is None:
        return 0
    # Onboard CSVs: attack ramp completes around t=130 (intensity=1.0).
    # Globe CSVs: teleport at t=12, smooth_drift cumulative — t=20 is solidly in.
    target = 135 if meta["mode"] == "onboard" else 20
    _inject_until[scenario_id] = target
    logger.info("inject scenario=%s → effective_tick≥%d", scenario_id, target)
    return target


def reset(scenario_id: str) -> None:
    _inject_until.pop(scenario_id, None)
    logger.info("inject reset scenario=%s", scenario_id)


def get_onboard_scored_direct(scenario_id: str) -> "ml_service.OnboardScored":
    """Return cached OnboardScored (pre-scoring if needed). Used by payload_builder."""
    return ml_service.get_onboard_scored(scenario_id, _csv_path(scenario_id))


def get_globe_scored_direct(scenario_id: str) -> "ml_service.GlobeScored":
    """Return cached GlobeScored (pre-scoring if needed). Used by payload_builder."""
    return ml_service.get_globe_scored(scenario_id, _csv_path(scenario_id))
