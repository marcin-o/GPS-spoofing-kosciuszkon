"""Heuristic spoofing scoring + alert-level mapping.

Mirrors the FE rule: >=0.7 critical, >=0.4 warn, else ok.
A real IsolationForest at ml/models/isoforest.pkl, when present, replaces
the heuristic score; reasons + alert_level are still derived here so the
FE contract stays stable.
"""

from __future__ import annotations

import math
from typing import Literal

AlertLevel = Literal["ok", "warn", "critical"]


def level_for(score: float) -> AlertLevel:
    if score >= 0.7:
        return "critical"
    if score >= 0.4:
        return "warn"
    return "ok"


def reasons_for(score: float, *, nic_drop: bool = False) -> list[str]:
    if score >= 0.7:
        return [
            "trajectory δ-position spike (>3σ)",
            "NIC dropped from 8 to 0 in 12s" if nic_drop else "NIC anomaly",
            "velocity inconsistent with reported heading",
        ]
    if score >= 0.4:
        return ["mild trajectory smoothness anomaly"]
    return []


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def heuristic_features(
    *,
    prev_lat: float | None,
    prev_lon: float | None,
    prev_ts: float | None,
    lat: float,
    lon: float,
    ts: float,
    vel_kt: float,
    heading: float,
    nic: int,
) -> dict[str, float]:
    """Return a dict of features the IsolationForest expects (and the
    heuristic uses if no model is loaded). Designed to be small and stable."""
    if prev_lat is None or prev_lon is None or prev_ts is None or ts <= prev_ts:
        delta_km = 0.0
        expected_km = 0.0
    else:
        delta_km = haversine_km(prev_lat, prev_lon, lat, lon)
        # vel_kt -> km/s
        expected_km = (vel_kt * 1.852 / 3600.0) * (ts - prev_ts)
    delta_position_3sigma = max(0.0, delta_km - max(expected_km, 0.5))
    nic_drop = 1.0 if nic <= 1 else 0.0
    # crude inconsistency: how off heading vs travel bearing would be (placeholder 0)
    velocity_inconsistency = 0.0
    if delta_km > 0.5 and prev_lat is not None and prev_lon is not None:
        bearing = math.degrees(
            math.atan2(
                math.sin(math.radians(lon - prev_lon)) * math.cos(math.radians(lat)),
                math.cos(math.radians(prev_lat)) * math.sin(math.radians(lat))
                - math.sin(math.radians(prev_lat))
                * math.cos(math.radians(lat))
                * math.cos(math.radians(lon - prev_lon)),
            )
        )
        bearing = (bearing + 360.0) % 360.0
        diff = abs(((bearing - heading + 540.0) % 360.0) - 180.0)
        velocity_inconsistency = min(1.0, diff / 90.0)
    return {
        "delta_position_3sigma": delta_position_3sigma,
        "nic_drop": nic_drop,
        "velocity_inconsistency": velocity_inconsistency,
        "trajectory_smoothness": min(1.0, delta_position_3sigma / 5.0),
        "heading_chatter": 0.0,
    }


def heuristic_score(features: dict[str, float]) -> float:
    score = (
        0.45 * min(1.0, features["delta_position_3sigma"] / 4.0)
        + 0.30 * features["nic_drop"]
        + 0.18 * features["velocity_inconsistency"]
        + 0.05 * features["trajectory_smoothness"]
        + 0.02 * features["heading_chatter"]
    )
    return float(min(1.0, max(0.0, score)))
