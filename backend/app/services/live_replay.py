"""Live ADS-B replay engine.

Loads `app/data/opensky_collected.parquet` (75k+ rows from real Europe
collection on 2026-05-09) on import. Cycles through snapshots on a
server-side timer, exposing the *current* snapshot as a list[dict]
matching OpenSky state shape so it's a drop-in for `opensky.fetch_states()`.

Two reasons to prefer this over live OpenSky API for the demo:
- offline / deterministic / reproducible
- aircraft trajectories evolve naturally between snapshots (~2 min apart),
  so the UI shows them moving instead of being frozen
"""
from __future__ import annotations

import logging
import threading
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

PARQUET_PATH = Path(__file__).resolve().parents[1] / "data" / "opensky_collected.parquet"
TICK_INTERVAL_S = 30.0  # advance to next snapshot every 30 seconds wall-clock

_snapshots: list[list[dict[str, Any]]] = []
_lock = threading.Lock()
_started_at: float = 0.0


def _load_parquet() -> None:
    """Load parquet once; group by snapshot_time into ordered list."""
    global _snapshots, _started_at
    if not PARQUET_PATH.exists():
        logger.warning("live_replay parquet not found at %s — disabled", PARQUET_PATH)
        return
    try:
        import pandas as pd
    except ImportError:
        logger.warning("pandas not installed — live_replay disabled")
        return

    df = pd.read_parquet(PARQUET_PATH)
    df = df.dropna(subset=["latitude", "longitude"])
    df = df[~df["on_ground"].fillna(False)]
    snap_times = sorted(df["snapshot_time"].unique())
    snaps: list[list[dict[str, Any]]] = []
    for t in snap_times:
        sub = df[df["snapshot_time"] == t]
        rows: list[dict[str, Any]] = []
        for _, r in sub.iterrows():
            rows.append({
                "icao24": str(r["icao24"]),
                "callsign": (str(r["callsign"]).strip() if r["callsign"] else None) or None,
                "origin_country": r.get("origin_country"),
                "time_position": float(r["time_position"]) if r.get("time_position") else None,
                "last_contact": float(r["last_contact"]) if r.get("last_contact") else None,
                "longitude": float(r["longitude"]),
                "latitude": float(r["latitude"]),
                "baro_altitude": float(r["baro_altitude"]) if r.get("baro_altitude") else None,
                "on_ground": bool(r.get("on_ground", False)),
                "velocity": float(r["velocity"]) if r.get("velocity") else None,
                "true_track": float(r["true_track"]) if r.get("true_track") else None,
                "vertical_rate": float(r["vertical_rate"]) if r.get("vertical_rate") else None,
                "geo_altitude": float(r["geo_altitude"]) if r.get("geo_altitude") else None,
            })
        snaps.append(rows)
    with _lock:
        _snapshots = snaps
        _started_at = time.time()
    logger.info("live_replay loaded %d snapshots (~%d aircraft per snap)",
                len(snaps), len(snaps[0]) if snaps else 0)


def is_available() -> bool:
    return bool(_snapshots)


def n_snapshots() -> int:
    return len(_snapshots)


def current_idx() -> int:
    """Index of the snapshot currently 'live', based on wall-clock since startup."""
    if not _snapshots:
        return 0
    elapsed = time.time() - _started_at
    return int(elapsed // TICK_INTERVAL_S) % len(_snapshots)


def current_snapshot() -> list[dict[str, Any]]:
    """Return the current snapshot's full list of aircraft (state-vector dicts)."""
    if not _snapshots:
        return []
    return _snapshots[current_idx()]


def snapshot_in_bbox(
    bbox: tuple[float, float, float, float] | None = None,
) -> list[dict[str, Any]]:
    """Return current snapshot filtered by bbox (lamin, lomin, lamax, lomax)."""
    snap = current_snapshot()
    if bbox is None:
        return snap
    lamin, lomin, lamax, lomax = bbox
    return [s for s in snap if lamin <= s["latitude"] <= lamax and lomin <= s["longitude"] <= lomax]


# Auto-load on import (cheap, ~2 MB parquet → ~30 MB in-memory)
_load_parquet()
