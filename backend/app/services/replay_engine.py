"""Scenario replay engine.

Reads a CSV scenario file and exposes:
    - tick(scenario_id, idx) → dict (one row, possibly with attack-injected overlay)
    - inject(scenario_id) → toggles a flag that fast-forwards the row index past
      the natural attack onset (so the next tick "feels" the attack immediately)
    - reset(scenario_id) → clears injection.

The engine is shared across WebSocket sessions but is stateless beyond the
inject flag (idx is per-session, passed in by the WS handler).
"""
from __future__ import annotations

import csv
import logging
import threading
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SCENARIO_DIR = Path(__file__).resolve().parents[1] / "scenarios"


_cache: dict[str, list[dict[str, Any]]] = {}
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
        "description": "Atak na warstwie sygnałowej: AGC up, C/N₀ var down, residuum pseudorange.",
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
        "description": "Wolny, ciągły drift dwóch samolotów — wykrywany przez LSTM-AE.",
    },
]

ID_TO_META = {s["id"]: s for s in SCENARIOS}


def list_scenarios() -> list[dict]:
    return [
        {k: v for k, v in s.items()}  # shallow copy
        for s in SCENARIOS
    ]


def get_meta(scenario_id: str) -> dict | None:
    return ID_TO_META.get(scenario_id)


def _load(scenario_id: str) -> list[dict[str, Any]]:
    with _lock:
        if scenario_id in _cache:
            return _cache[scenario_id]
        path = SCENARIO_DIR / f"{scenario_id}.csv"
        if not path.exists():
            raise FileNotFoundError(f"scenario {scenario_id} not found at {path}")
        rows: list[dict[str, Any]] = []
        with path.open(newline="") as f:
            reader = csv.DictReader(f)
            for r in reader:
                # Coerce numerics.
                conv: dict[str, Any] = {}
                for k, v in r.items():
                    if k in ("callsign", "icao24", "origin_country", "anomaly_kind"):
                        conv[k] = v
                        continue
                    try:
                        conv[k] = float(v)
                    except (TypeError, ValueError):
                        conv[k] = v
                rows.append(conv)
        _cache[scenario_id] = rows
        logger.info("loaded scenario %s: %d rows", scenario_id, len(rows))
        return rows


def onboard_tick(scenario_id: str, tick_idx: int) -> dict[str, Any]:
    rows = _load(scenario_id)
    n = len(rows)
    # If injection has been triggered, skip ahead so the attack is "now".
    if _inject_until.get(scenario_id, 0) > tick_idx:
        tick_idx = _inject_until[scenario_id]
    return rows[tick_idx % n]


def globe_tick_batch(scenario_id: str, tick_idx: int) -> list[dict[str, Any]]:
    rows = _load(scenario_id)
    # Group rows by tick.
    if "tick" not in rows[0]:
        return rows
    n_ticks = int(max(r["tick"] for r in rows)) + 1
    if _inject_until.get(scenario_id, 0) > tick_idx:
        tick_idx = _inject_until[scenario_id]
    target = tick_idx % n_ticks
    return [r for r in rows if int(r["tick"]) == target]


def inject(scenario_id: str) -> int:
    """Flag the scenario so subsequent ticks jump to its attack window."""
    meta = get_meta(scenario_id)
    if meta is None:
        return 0
    if meta["mode"] == "onboard":
        # Onboard CSVs have attack starting at row 80; jump to 90 for impact.
        target = 95
    else:
        # Globe scenarios have anomalies at tick 12+; jump to 13.
        target = 14
    _inject_until[scenario_id] = target
    logger.info("inject scenario=%s target_tick=%d", scenario_id, target)
    return target


def reset(scenario_id: str) -> None:
    _inject_until.pop(scenario_id, None)


def trajectory_from_row(row: dict[str, Any]) -> list[list[float]]:
    """Reconstruct LSTM_TRAJ_LEN×LSTM_TRAJ_DIM trajectory from globe row."""
    from ml.schemas import LSTM_TRAJ_DIM, LSTM_TRAJ_LEN
    out: list[list[float]] = []
    for i in range(LSTM_TRAJ_LEN):
        step = []
        for j in range(LSTM_TRAJ_DIM):
            step.append(float(row.get(f"traj_{i}_{j}", 0.0)))
        out.append(step)
    return out
