"""Generate scenario CSVs in the schema MLdev's models actually consume.

Onboard scenarios share ONE CSV that holds BOTH:
  - TEXBAT receiver-side columns (24 features + ``t_int`` for baseline window)
  - Aissou per-channel columns (80 features = 10 metrics × 8 channels)

so the same row can be passed through L1 (texbat) and L2 (aissou) without
juggling two files. Onboard CSVs are 200 ticks long (per-second cadence
emulated; ``t_int = tick``). Baseline window for TEXBAT z-score is t∈[30,100)
so attacks always start at t≥100 to keep the baseline clean.

Globe scenarios produce raw OpenSky-shaped multi-time snapshot rows
(``icao24``, ``snapshot_idx``, ``latitude``, ``longitude``, …). MLdev's
``extract_opensky_features`` and ``extract_trajectory_features`` derive the
final features from these.

All values fixed-seed for reproducibility.
"""
from __future__ import annotations

import csv
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "backend" / "app" / "scenarios"
OUT.mkdir(parents=True, exist_ok=True)

SEED = 4242


# ─────────────────────────────────────────────────── ML-team feature columns

TEXBAT_FEATURES = [
    'n_sv', 'cn0_mean', 'cn0_std', 'cn0_min', 'cn0_max',
    'doppler_std', 'pseudorange_std',
    'error_flag_any',
    'sqm_peak_mean', 'sqm_peak_std',
    'sqm_asym_mean', 'sqm_asym_max',
    'sqm_sec_peak_mean', 'sqm_sec_peak_max',
    'sqm_left_5_mean', 'sqm_right_5_mean',
    'power_2MHz', 'power_4MHz', 'power_8MHz',
    'clock_error_m', 'clock_drift_mps',
    'position_drift_m', 'speed_ecef', 'clock_error_d_dt',
]

AISSOU_METRICS = [
    'Carrier_Doppler_hz', 'Pseudorange_m', 'Carrier_phase_cycles',
    'EC', 'LC', 'PC', 'PIP', 'PQP', 'TCD', 'CN0',
]
AISSOU_FEATURES = [f"{m}_ch{ch}" for m in AISSOU_METRICS for ch in range(8)]


# ─────────────────────────────────────────────────── plausible value generators

def _texbat_clean(rng: random.Random) -> dict[str, float]:
    """Plausible clean GNSS receiver state."""
    cn0_mean = rng.gauss(45.0, 1.5)
    return {
        'n_sv':              float(rng.randint(9, 12)),
        'cn0_mean':          cn0_mean,
        'cn0_std':           rng.gauss(2.5, 0.4),
        'cn0_min':           cn0_mean - rng.uniform(4, 6),
        'cn0_max':           cn0_mean + rng.uniform(4, 6),
        'doppler_std':       rng.gauss(80, 10),
        'pseudorange_std':   rng.gauss(2.0, 0.5),
        'error_flag_any':    0.0,
        'sqm_peak_mean':     rng.gauss(1.00, 0.02),
        'sqm_peak_std':      rng.gauss(0.05, 0.01),
        'sqm_asym_mean':     rng.gauss(0.0, 0.03),
        'sqm_asym_max':      rng.gauss(0.10, 0.03),
        'sqm_sec_peak_mean': rng.gauss(0.45, 0.05),
        'sqm_sec_peak_max':  rng.gauss(0.55, 0.05),
        'sqm_left_5_mean':   rng.gauss(0.40, 0.03),
        'sqm_right_5_mean':  rng.gauss(0.40, 0.03),
        'power_2MHz':        rng.gauss(-45.0, 1.5),
        'power_4MHz':        rng.gauss(-46.0, 1.5),
        'power_8MHz':        rng.gauss(-48.0, 1.5),
        'clock_error_m':     rng.gauss(0.0, 3.0),
        'clock_drift_mps':   rng.gauss(0.0, 0.3),
        'position_drift_m':  abs(rng.gauss(2.0, 0.8)),
        'speed_ecef':        rng.gauss(220.0, 4.0),
        'clock_error_d_dt':  rng.gauss(0.0, 0.2),
    }


def _texbat_attack_overlay(row: dict, intensity: float, rng: random.Random) -> None:
    """Apply a 'drift'-phase TEXBAT spoofing signature in place.

    Mirrors the dominant signals MLdev's xgb pickup on (recall=0.98 on drift):
    elevated power, asymmetric correlator peaks, growing position drift,
    clock error divergence.
    """
    k = max(0.0, min(1.0, intensity))
    row['power_2MHz']        += k * rng.gauss(8.0, 1.0)
    row['power_4MHz']        += k * rng.gauss(7.0, 1.0)
    row['power_8MHz']        += k * rng.gauss(6.0, 1.0)
    row['cn0_mean']          += k * rng.gauss(3.0, 0.5)
    row['cn0_std']            = max(0.2, row['cn0_std'] * (1 - 0.6 * k))
    row['sqm_peak_mean']     -= k * rng.gauss(0.20, 0.03)
    row['sqm_peak_std']      += k * rng.gauss(0.08, 0.02)
    row['sqm_asym_mean']     += k * rng.gauss(0.20, 0.04)
    row['sqm_asym_max']      += k * rng.gauss(0.30, 0.05)
    row['sqm_sec_peak_mean'] += k * rng.gauss(0.20, 0.03)
    row['sqm_sec_peak_max']  += k * rng.gauss(0.25, 0.04)
    row['pseudorange_std']   += k * rng.gauss(8.0, 1.5)
    row['position_drift_m']  += k * rng.gauss(35.0, 5.0)
    row['clock_error_m']     += k * rng.gauss(15.0, 3.0)
    row['clock_drift_mps']   += k * rng.gauss(2.0, 0.3)
    row['clock_error_d_dt']  += k * rng.gauss(2.0, 0.4)
    row['doppler_std']       += k * rng.gauss(40.0, 8.0)


def _aissou_clean(rng: random.Random) -> dict[str, float]:
    out: dict[str, float] = {}
    for ch in range(8):
        out[f'Carrier_Doppler_hz_ch{ch}']    = rng.gauss(0.0, 1500.0)
        out[f'Pseudorange_m_ch{ch}']         = rng.gauss(2.2e7, 1.5e6)
        out[f'Carrier_phase_cycles_ch{ch}']  = rng.gauss(0.0, 1e6)
        out[f'EC_ch{ch}']                    = rng.gauss(800.0, 100.0)
        out[f'LC_ch{ch}']                    = rng.gauss(800.0, 100.0)
        out[f'PC_ch{ch}']                    = rng.gauss(1500.0, 150.0)
        out[f'PIP_ch{ch}']                   = rng.gauss(1500.0, 200.0)
        out[f'PQP_ch{ch}']                   = rng.gauss(0.0, 200.0)
        out[f'TCD_ch{ch}']                   = rng.gauss(0.0, 0.05)
        out[f'CN0_ch{ch}']                   = rng.gauss(45.0, 2.0)
    return out


def _aissou_attack_overlay(row: dict, intensity: float, rng: random.Random,
                            *, channels: tuple[int, ...] = (3, 5)) -> None:
    """Channel-spoofing signature on selected PRNs."""
    k = max(0.0, min(1.0, intensity))
    for ch in channels:
        row[f'Carrier_Doppler_hz_ch{ch}']    += k * rng.gauss(4000.0, 500.0)
        row[f'Pseudorange_m_ch{ch}']         += k * rng.gauss(8000.0, 1000.0)
        row[f'EC_ch{ch}']                    += k * rng.gauss(400.0, 50.0)
        row[f'LC_ch{ch}']                    -= k * rng.gauss(300.0, 50.0)
        row[f'PIP_ch{ch}']                   += k * rng.gauss(800.0, 100.0)
        row[f'PQP_ch{ch}']                   += k * rng.gauss(600.0, 100.0)
        row[f'TCD_ch{ch}']                   += k * rng.gauss(0.20, 0.04)
        row[f'CN0_ch{ch}']                   += k * rng.gauss(8.0, 1.5)


# ─────────────────────────────────────────────────── ONBOARD scenario writer

def write_onboard(name: str, *,
                   attack_layer: str | None,
                   attack_start: int = 100,
                   total: int = 200) -> Path:
    cols = (
        ['tick', 't_int', 'lat', 'lon', 'alt', 'heading', 'callsign', 'is_attack']
        + TEXBAT_FEATURES
        + AISSOU_FEATURES
    )
    rng = random.Random(SEED + sum(ord(c) for c in name))

    waw, gdn = (52.165, 20.967), (54.378, 18.466)
    callsign = "LOT283"

    rows = []
    for i in range(total):
        t_frac = i / max(1, total - 1)
        lat = waw[0] + (gdn[0] - waw[0]) * t_frac
        lon = waw[1] + (gdn[1] - waw[1]) * t_frac
        alt = 9500 + 200 * math.sin(i * 0.1)
        hdg = 327.0

        tx = _texbat_clean(rng)
        ai = _aissou_clean(rng)

        is_attack = 0
        if attack_layer and i >= attack_start:
            intensity = min(1.0, (i - attack_start) / 30.0)
            if attack_layer == 'L1':
                _texbat_attack_overlay(tx, intensity, rng)
            elif attack_layer == 'L2':
                _aissou_attack_overlay(ai, intensity, rng)
            is_attack = 1

        row = {
            'tick': i, 't_int': i,
            'lat': round(lat, 5), 'lon': round(lon, 5),
            'alt': round(alt, 1), 'heading': round(hdg, 1),
            'callsign': callsign, 'is_attack': is_attack,
        }
        row.update({k: round(float(v), 4) for k, v in tx.items()})
        row.update({k: round(float(v), 4) for k, v in ai.items()})
        rows.append(row)

    path = OUT / f"{name}.csv"
    with path.open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            for c in cols:
                r.setdefault(c, 0)
            w.writerow(r)
    return path


# ─────────────────────────────────────────────────── GLOBE scenario writer
# Raw OpenSky-shape multi-time snapshots; MLdev's extractors do the rest.

GLOBE_FLEET = [
    # icao24, callsign, country, lat, lon, alt(m), velocity(m/s), track(deg)
    ('4ca87b', 'RYR2KE',  'Ireland',         54.4, 18.5, 11000, 230, 90),
    ('471f8b', 'LOT283',  'Poland',          52.5, 20.9,  9500, 220, 320),
    ('3c6589', 'DLH4ZW',  'Germany',         53.5, 14.5, 11500, 240, 80),
    ('4b1805', 'SWR12X',  'Switzerland',     52.8, 18.0, 10800, 235, 200),
    ('440048', 'BAW893',  'United Kingdom',  53.0, 16.0, 12000, 250, 60),
    ('4ac9b0', 'SAS2HK',  'Sweden',          55.5, 17.0, 10500, 220, 120),
    ('3917a3', 'AFR1219', 'France',          51.0, 14.5, 11000, 225, 150),
    ('46b8c1', 'FIN6KP',  'Finland',         56.0, 21.0, 10000, 215, 200),
    ('4ca8e0', 'RYR3LM',  'Ireland',         53.7, 19.8, 11200, 232, 240),
    ('478129', 'WZZ2BV',  'Hungary',         51.7, 22.5, 10800, 220, 280),
    ('4ba8c2', 'TAR9FX',  'Turkey',          52.2, 23.5,  9500, 245, 270),
    ('4cab4c', 'EZY42AC', 'United Kingdom',  54.6, 17.5, 11800, 238, 100),
]


def _step_aircraft(ac: dict, dt_s: float, rng: random.Random) -> None:
    R = 6371000.0
    bearing = math.radians(ac['true_track'])
    distance = ac['velocity'] * dt_s
    lat1 = math.radians(ac['latitude']); lon1 = math.radians(ac['longitude'])
    lat2 = math.asin(math.sin(lat1) * math.cos(distance / R)
                     + math.cos(lat1) * math.sin(distance / R) * math.cos(bearing))
    lon2 = lon1 + math.atan2(math.sin(bearing) * math.sin(distance / R) * math.cos(lat1),
                              math.cos(distance / R) - math.sin(lat1) * math.sin(lat2))
    ac['latitude']      = math.degrees(lat2)
    ac['longitude']     = math.degrees(lon2)
    ac['baro_altitude'] += rng.gauss(0, 5)


def write_globe(name: str, *, anomaly_kind: str | None,
                 anomaly_targets: tuple[str, ...] = (),
                 total_ticks: int = 60,
                 dt_s: float = 15.0) -> Path:
    rng = random.Random(SEED + sum(ord(c) for c in name))

    fleet = []
    for icao, cs, country, lat, lon, alt, vel, track in GLOBE_FLEET:
        fleet.append({
            'icao24': icao, 'callsign': cs, 'origin_country': country,
            'latitude': lat, 'longitude': lon, 'baro_altitude': float(alt),
            'velocity': float(vel), 'true_track': float(track),
            'vertical_rate': 0.0, 'on_ground': False,
        })

    cols = [
        'tick', 'snapshot_idx', 'snapshot_time',
        'icao24', 'callsign', 'origin_country',
        'latitude', 'longitude', 'baro_altitude', 'geo_altitude',
        'velocity', 'true_track', 'vertical_rate',
        'on_ground', 'time_position', 'last_contact', 'position_source',
        'is_anomaly', 'anomaly_kind',
    ]

    rows = []
    base_time = 1700000000  # arbitrary epoch
    for tick in range(total_ticks):
        snap_time = base_time + tick * dt_s
        for ac in fleet:
            _step_aircraft(ac, dt_s=dt_s, rng=rng)
            is_anomaly = 0
            kind = ''
            if anomaly_kind and tick >= 8 and ac['callsign'] in anomaly_targets:
                if anomaly_kind == 'teleport':
                    if tick == 12:
                        ac['latitude']      += 2.5    # ~280 km jump
                        ac['longitude']     -= 1.5
                        ac['baro_altitude'] -= 2000
                    is_anomaly = 1
                    kind = 'teleport'
                elif anomaly_kind == 'smooth_drift':
                    drift_t = (tick - 8) / max(1, total_ticks - 8)
                    ac['latitude']  += 0.04 * drift_t
                    ac['longitude'] -= 0.06 * drift_t
                    is_anomaly = 1
                    kind = 'smooth_drift'

            row = {
                'tick': tick,
                'snapshot_idx': tick,
                'snapshot_time': snap_time,
                'icao24': ac['icao24'],
                'callsign': ac['callsign'],
                'origin_country': ac['origin_country'],
                'latitude':       round(ac['latitude'], 5),
                'longitude':      round(ac['longitude'], 5),
                'baro_altitude':  round(ac['baro_altitude'], 1),
                'geo_altitude':   round(ac['baro_altitude'] + rng.gauss(20, 5), 1),
                'velocity':       round(ac['velocity'], 1),
                'true_track':     round(ac['true_track'], 1),
                'vertical_rate':  round(ac['vertical_rate'], 2),
                'on_ground':      bool(ac['on_ground']),
                'time_position':  snap_time,
                'last_contact':   snap_time,
                'position_source': 0,  # 0 = ADS-B
                'is_anomaly':     is_anomaly,
                'anomaly_kind':   kind,
            }
            rows.append(row)

    path = OUT / f"{name}.csv"
    with path.open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    return path


def main() -> None:
    print(write_onboard('normal_waw_gdn',         attack_layer=None))
    print(write_onboard('texbat_spoof',           attack_layer='L1', attack_start=100))
    print(write_onboard('aissou_channel_attack',  attack_layer='L2', attack_start=100))
    print(write_globe('baltic_teleport',
                       anomaly_kind='teleport',
                       anomaly_targets=('RYR2KE', 'DLH4ZW')))
    print(write_globe('smooth_drift_fleet',
                       anomaly_kind='smooth_drift',
                       anomaly_targets=('BAW893', 'AFR1219')))


if __name__ == '__main__':
    main()
