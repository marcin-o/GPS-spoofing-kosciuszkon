"""Scenario replay engine.

Each scenario CSV is pre-scored once (lazy on first reference) by
``ml_service.get_*_scored``, then ticks are streamed from the cached
result. The engine exposes:

  - ``onboard_tick(scenario_id, tick_idx)`` → ``(raw_row, scored, idx)``
  - ``globe_tick_batch(scenario_id, tick_idx)`` → ``(aircraft_list, idx)``
  - ``effective_tick(scenario_id, tick_idx)`` → identity helper
    (kept as a stable name; payload_builder still emits the field).
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
_lock = threading.Lock()


SCENARIOS = [
    {
        "id": "normal_waw_gdn",
        "name": "Lot normalny: WAW → GDN",
        "mode": "onboard",
        "duration_s": 25.0,
        "expected_dominant_layer": None,
        "description": "Czyste odczyty na trasie Warszawa-Gdańsk. Verdict pozostaje OK.",
    },
    {
        "id": "texbat_spoof",
        "name": "TEXBAT spoofing (sygnał)",
        "mode": "onboard",
        "duration_s": 25.0,
        "expected_dominant_layer": "L1",
        "description": "Atak na warstwie sygnałowej: power up, sqm asym, position drift.",
    },
    {
        "id": "aissou_channel_attack",
        "name": "Atak kanałowy Aissou",
        "mode": "onboard",
        "duration_s": 25.0,
        "expected_dominant_layer": "L2",
        "description": "Anomalia per-kanał na PRN3 i PRN5 (Aissou L2).",
    },
    {
        "id": "baltic_teleport",
        "name": "Bałtyk: teleport",
        "mode": "live_globe",
        "duration_s": 22.0,
        "expected_dominant_layer": "ensemble",
        "description": "Flotylla nad Bałtykiem; dwa samoloty wykonują skok pozycji ~280 km.",
    },
    {
        "id": "smooth_drift_fleet",
        "name": "Płynny drift (live)",
        "mode": "live_globe",
        "duration_s": 22.0,
        "expected_dominant_layer": "ensemble",
        "description": "Wolny, ciągły drift dwóch samolotów — wykrywany przez IsolationForest multitime.",
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
    """Identity wrapper. Kept for back-compat with payload_builder + the
    ``effective_tick`` field in the replay WS payload (test_replay_ws asserts
    on it). Used to map a monotonic counter through an inject fast-forward;
    inject is gone, so this just returns ``tick_idx``."""
    return tick_idx


# ─────────────────────────────────────────────────── onboard

def onboard_tick(scenario_id: str, tick_idx: int) -> tuple[dict, "ml_service.OnboardScored", int]:
    """Returns (raw_row, scored, idx)."""
    rows = _load_raw(scenario_id)
    scored = ml_service.get_onboard_scored(scenario_id, _csv_path(scenario_id))
    n = len(rows)
    # Clamp at last tick instead of looping — prevents end-of-scenario teleport
    # back to t=0 (visible as a discontinuous jump on the live globe).
    idx = min(tick_idx, n - 1)
    return rows[idx], scored, idx


# ─────────────────────────────────────────────────── globe

def globe_tick_batch(scenario_id: str, tick_idx: int) -> tuple[list[dict], int]:
    """Returns (scored_aircraft_list, idx)."""
    scored = ml_service.get_globe_scored(scenario_id, _csv_path(scenario_id))
    n = scored.n_ticks
    idx = min(tick_idx, n - 1)
    return scored.aircraft_per_tick[idx], idx


def get_onboard_scored_direct(scenario_id: str) -> "ml_service.OnboardScored":
    """Return cached OnboardScored (pre-scoring if needed). Used by payload_builder."""
    return ml_service.get_onboard_scored(scenario_id, _csv_path(scenario_id))


def get_globe_scored_direct(scenario_id: str) -> "ml_service.GlobeScored":
    """Return cached GlobeScored (pre-scoring if needed). Used by payload_builder."""
    return ml_service.get_globe_scored(scenario_id, _csv_path(scenario_id))
