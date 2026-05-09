"""Generate scenario CSVs for the replay engine.

Each scenario file contains one row per tick with all the feature columns
its target model expects, plus position/heading metadata for the UI.
Files are written under ``backend/app/scenarios/``.

Five scenarios:
- normal_waw_gdn        (onboard)  — clean WAW→GDN, no spoofing.
- texbat_spoof          (onboard)  — L1 (signal) attack picks up around tick 80.
- aissou_channel_attack (onboard)  — L2 (channel) attack on PRN3, PRN5.
- baltic_teleport       (live globe) — fleet over Baltic, one teleports.
- smooth_drift_fleet    (live globe) — fleet with 2 slowly drifting aircraft.
"""
from __future__ import annotations

import csv
import math
import random
from pathlib import Path

from ml.schemas import (
    AISSOU_FEATURES,
    LSTM_TRAJ_DIM,
    LSTM_TRAJ_LEN,
    OPENSKY_FEATURES,
    TEXBAT_FEATURES,
)

SEED = 4242
OUT = Path(__file__).resolve().parents[1] / "backend" / "app" / "scenarios"
OUT.mkdir(parents=True, exist_ok=True)


def _interp(t: float, a: float, b: float) -> float:
    return a + (b - a) * max(0.0, min(1.0, t))


# ---------------- Onboard scenarios (per-tick: 100ms cadence) ---------------

def _onboard_row_clean(tick: int, lat: float, lon: float, alt: float, hdg: float) -> dict:
    rng = random.Random(SEED + tick)
    base = {f: rng.gauss(0, 0.3) for f in TEXBAT_FEATURES}
    base["cn0_mean"] = rng.gauss(45, 1.5)
    base["cn0_std"] = rng.gauss(2.5, 0.4)
    base["cn0_min"] = base["cn0_mean"] - 5
    base["cn0_max"] = base["cn0_mean"] + 5
    base["agc_mean"] = rng.gauss(0.4, 0.03)
    base["agc_std"] = rng.gauss(0.05, 0.01)
    base["pseudorange_residual_mean"] = rng.gauss(0, 4)
    base["doppler_mean"] = rng.gauss(1500, 50)
    base["doppler_std"] = rng.gauss(80, 10)
    base["doppler_residual"] = rng.gauss(0, 3)
    base["satellite_count"] = 11 + rng.randint(-1, 1)
    base["multipath_indicator"] = rng.gauss(0.1, 0.03)

    aissou = {f: rng.gauss(0, 0.3) for f in AISSOU_FEATURES}
    return {
        "tick": tick,
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "alt": round(alt, 1),
        "heading": round(hdg, 1),
        **{f"tx_{k}": round(v, 4) for k, v in base.items()},
        **{f"ai_{k}": round(v, 4) for k, v in aissou.items()},
    }


def _texbat_attack_overlay(row: dict, intensity: float) -> dict:
    """Apply L1 spoofing pattern: AGC up, C/N0 var down, pseudorange residual up."""
    row["tx_cn0_std"] = round(_interp(intensity, row["tx_cn0_std"], 0.5), 4)
    row["tx_agc_mean"] = round(_interp(intensity, row["tx_agc_mean"], 0.7), 4)
    row["tx_pseudorange_residual_mean"] = round(_interp(intensity, row["tx_pseudorange_residual_mean"], 90), 4)
    row["tx_doppler_residual"] = round(_interp(intensity, row["tx_doppler_residual"], 45), 4)
    row["tx_multipath_indicator"] = round(_interp(intensity, row["tx_multipath_indicator"], 0.85), 4)
    return row


def _aissou_attack_overlay(row: dict, intensity: float) -> dict:
    """L2: channels 3 and 5 anomalous on cn0/doppler/residual/variance."""
    for ch in (3, 5):
        for m in ("cn0", "doppler", "residual", "variance"):
            k = f"ai_ch{ch}_{m}"
            row[k] = round(_interp(intensity, row.get(k, 0.0), 4.0), 4)
    return row


def write_onboard(name: str, *, attack_layer: str | None,
                   attack_start: int = 80, total: int = 200) -> Path:
    cols = (
        ["tick", "lat", "lon", "alt", "heading", "callsign", "is_attack"]
        + [f"tx_{f}" for f in TEXBAT_FEATURES]
        + [f"ai_{f}" for f in AISSOU_FEATURES]
    )
    rows = []
    # WAW (Warsaw) → GDN (Gdańsk) great-circle approx.
    waw = (52.165, 20.967)
    gdn = (54.378, 18.466)
    callsign = "LOT283"
    for i in range(total):
        t = i / (total - 1)
        lat = waw[0] + (gdn[0] - waw[0]) * t
        lon = waw[1] + (gdn[1] - waw[1]) * t
        alt = 9500 + 200 * math.sin(i * 0.1)
        hdg = 327.0
        row = _onboard_row_clean(i, lat, lon, alt, hdg)
        row["callsign"] = callsign
        is_attack = 0
        if attack_layer and i >= attack_start:
            intensity = min(1.0, (i - attack_start) / 30)
            if attack_layer == "L1":
                _texbat_attack_overlay(row, intensity)
            elif attack_layer == "L2":
                _aissou_attack_overlay(row, intensity)
            is_attack = 1
        row["is_attack"] = is_attack
        rows.append(row)
    path = OUT / f"{name}.csv"
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=cols)
        writer.writeheader()
        for r in rows:
            for c in cols:
                r.setdefault(c, 0)
            writer.writerow(r)
    return path


# ---------------- Globe scenarios (per-tick: 1500ms cadence) ----------------
# Each row = one tick (one batch). One CSV row per (tick, aircraft).

GLOBE_FLEET = [
    # icao24,   callsign, country,  lat0, lon0, alt, vel, track
    ("4ca87b", "RYR2KE", "Ireland",        54.4, 18.5, 11000, 230, 90),
    ("471f8b", "LOT283", "Poland",         52.5, 20.9,  9500, 220, 320),
    ("3c6589", "DLH4ZW", "Germany",        53.5, 14.5, 11500, 240, 80),
    ("4b1805", "SWR12X", "Switzerland",    52.8, 18.0, 10800, 235, 200),
    ("440048", "BAW893", "United Kingdom", 53.0, 16.0, 12000, 250, 60),
    ("4ac9b0", "SAS2HK", "Sweden",         55.5, 17.0, 10500, 220, 120),
    ("3917a3", "AFR1219", "France",        51.0, 14.5, 11000, 225, 150),
    ("46b8c1", "FIN6KP", "Finland",        56.0, 21.0, 10000, 215, 200),
    ("4ca8e0", "RYR3LM", "Ireland",        53.7, 19.8, 11200, 232, 240),
    ("478129", "WZZ2BV", "Hungary",        51.7, 22.5, 10800, 220, 280),
    ("4ba8c2", "TAR9FX", "Turkey",         52.2, 23.5,  9500, 245, 270),
    ("4cab4c", "EZY42AC", "United Kingdom",54.6, 17.5, 11800, 238, 100),
]


def _opensky_features_clean(rng: random.Random, ac: dict) -> dict:
    f = {k: rng.gauss(0, 0.2) for k in OPENSKY_FEATURES}
    f["lat"] = ac["lat"]; f["lon"] = ac["lon"]; f["alt"] = ac["alt"]
    f["velocity"] = ac["velocity"]; f["true_track"] = ac["true_track"]
    f["vertical_rate"] = rng.gauss(0, 1.0)
    f["nic"] = 8.0; f["nac_v"] = 9; f["nac_p"] = 9
    f["trajectory_smoothness"] = rng.gauss(0.92, 0.02)
    f["altitude_jitter"] = rng.gauss(0.4, 0.1)
    f["callsign_country_match"] = 1.0
    return f


def _step_aircraft(ac: dict, dt_s: float, rng: random.Random) -> None:
    R = 6371000.0
    bearing = math.radians(ac["true_track"])
    distance = ac["velocity"] * dt_s
    lat1 = math.radians(ac["lat"]); lon1 = math.radians(ac["lon"])
    lat2 = math.asin(math.sin(lat1) * math.cos(distance / R)
                     + math.cos(lat1) * math.sin(distance / R) * math.cos(bearing))
    lon2 = lon1 + math.atan2(math.sin(bearing) * math.sin(distance / R) * math.cos(lat1),
                              math.cos(distance / R) - math.sin(lat1) * math.sin(lat2))
    ac["lat"] = math.degrees(lat2)
    ac["lon"] = math.degrees(lon2)
    ac["alt"] += rng.gauss(0, 5)


def _build_trajectory(ac_history: list[dict]) -> list[list[float]]:
    if not ac_history:
        return []
    out = []
    for snap in ac_history[-LSTM_TRAJ_LEN:]:
        out.append([snap["lat"], snap["lon"], snap["alt"],
                    snap["velocity"], snap["true_track"]])
    return out


def write_globe(name: str, *, anomaly_kind: str | None,
                 anomaly_targets: list[str], total_ticks: int = 60) -> Path:
    rng = random.Random(SEED + sum(ord(c) for c in name))
    fleet = []
    for icao, cs, country, lat, lon, alt, vel, track in GLOBE_FLEET:
        fleet.append({
            "icao24": icao, "callsign": cs, "origin_country": country,
            "lat": lat, "lon": lon, "alt": alt, "velocity": vel,
            "true_track": track, "vertical_rate": 0.0, "on_ground": 0,
        })
    history: dict[str, list[dict]] = {ac["icao24"]: [] for ac in fleet}

    cols = (
        ["tick", "icao24", "callsign", "origin_country",
         "lat", "lon", "alt", "velocity", "true_track", "vertical_rate", "on_ground",
         "is_anomaly", "anomaly_kind"]
        + [f"f_{k}" for k in OPENSKY_FEATURES]
        + [f"traj_{i}_{j}" for i in range(LSTM_TRAJ_LEN) for j in range(LSTM_TRAJ_DIM)]
    )

    rows = []
    for tick in range(total_ticks):
        for ac in fleet:
            _step_aircraft(ac, dt_s=1.5, rng=rng)
            history[ac["icao24"]].append(dict(ac))
            is_anomaly = 0
            kind = ""
            # Apply anomalies after tick 8.
            if anomaly_kind and tick >= 8 and ac["callsign"] in anomaly_targets:
                if anomaly_kind == "teleport":
                    if tick == 12:
                        ac["lat"] += 2.5  # ~280 km jump
                        ac["lon"] -= 1.5
                        ac["alt"] -= 2000
                    is_anomaly = 1; kind = "teleport"
                elif anomaly_kind == "smooth_drift":
                    drift_t = (tick - 8) / max(1, total_ticks - 8)
                    ac["lat"] += 0.04 * drift_t
                    ac["lon"] -= 0.06 * drift_t
                    is_anomaly = 1; kind = "smooth_drift"

            f = _opensky_features_clean(rng, ac)
            if is_anomaly and kind == "teleport" and tick >= 12:
                f["lat_delta"] = 2.5
                f["lon_delta"] = -1.5
                f["altitude_jitter"] = 4.0
                f["nic"] = 0
                f["trajectory_smoothness"] = 0.05
                f["velocity"] = 880
            elif is_anomaly and kind == "smooth_drift":
                f["lat_delta"] = 0.04
                f["lon_delta"] = -0.06
                f["nic"] = 6
                f["trajectory_smoothness"] = 0.4

            row = {
                "tick": tick,
                "icao24": ac["icao24"],
                "callsign": ac["callsign"],
                "origin_country": ac["origin_country"],
                "lat": round(ac["lat"], 5),
                "lon": round(ac["lon"], 5),
                "alt": round(ac["alt"], 1),
                "velocity": round(ac["velocity"], 1),
                "true_track": round(ac["true_track"], 1),
                "vertical_rate": round(ac["vertical_rate"], 2),
                "on_ground": int(ac["on_ground"]),
                "is_anomaly": is_anomaly,
                "anomaly_kind": kind,
            }
            for k, v in f.items():
                row[f"f_{k}"] = round(float(v), 4)
            traj = _build_trajectory(history[ac["icao24"]])
            # Pad trajectory to LSTM_TRAJ_LEN.
            while len(traj) < LSTM_TRAJ_LEN:
                traj.insert(0, traj[0] if traj else [ac["lat"], ac["lon"], ac["alt"],
                                                     ac["velocity"], ac["true_track"]])
            for i in range(LSTM_TRAJ_LEN):
                for j in range(LSTM_TRAJ_DIM):
                    row[f"traj_{i}_{j}"] = round(float(traj[i][j]), 4)
            rows.append(row)

    path = OUT / f"{name}.csv"
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=cols)
        writer.writeheader()
        for r in rows:
            for c in cols:
                r.setdefault(c, 0)
            writer.writerow(r)
    return path


def main() -> None:
    print(write_onboard("normal_waw_gdn", attack_layer=None))
    print(write_onboard("texbat_spoof", attack_layer="L1", attack_start=80))
    print(write_onboard("aissou_channel_attack", attack_layer="L2", attack_start=80))
    print(write_globe("baltic_teleport",
                       anomaly_kind="teleport",
                       anomaly_targets=["RYR2KE", "DLH4ZW"]))
    print(write_globe("smooth_drift_fleet",
                       anomaly_kind="smooth_drift",
                       anomaly_targets=["BAW893", "AFR1219"]))


if __name__ == "__main__":
    main()
