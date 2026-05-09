"""Feature schemas per scenario.

These define the input contract for `ml.inference.score()`. Each scenario
has a fixed feature list — feeding extra/missing keys is tolerated (extras
are ignored, missing keys default to 0.0).
"""
from __future__ import annotations

# TEXBAT receiver-side features (signal layer L1).
# 27 dims — pseudoranges/Doppler residuals, C/N0 stats, AGC, clock bias.
TEXBAT_FEATURES = [
    "cn0_mean", "cn0_std", "cn0_min", "cn0_max",
    "doppler_mean", "doppler_std", "doppler_residual",
    "pseudorange_residual_mean", "pseudorange_residual_std",
    "agc_mean", "agc_std",
    "carrier_phase_var",
    "clock_bias", "clock_drift",
    "satellite_count", "satellite_visibility",
    "hdop", "vdop", "pdop",
    "snr_above_threshold_count",
    "code_minus_carrier_mean", "code_minus_carrier_std",
    "lock_time_mean", "lock_time_std",
    "ephemeris_age",
    "multipath_indicator",
    "spoof_score_legacy",
]

# Aissou per-channel features (channel layer L2).
# 80 = 12 metrics × 8 channels.
AISSOU_METRICS = [
    "cn0", "doppler", "pseudorange", "carrier_phase",
    "agc", "lock_time", "snr", "code_minus_carrier",
    "elevation", "azimuth", "residual", "variance",
]
AISSOU_NUM_CHANNELS = 8
AISSOU_FEATURES = [
    f"ch{ch}_{m}" for ch in range(AISSOU_NUM_CHANNELS) for m in AISSOU_METRICS
]

# OpenSky ADS-B features (live globe ensemble L3).
OPENSKY_FEATURES = [
    "lat", "lon", "alt", "velocity", "true_track", "vertical_rate",
    "lat_delta", "lon_delta", "speed_delta", "heading_delta",
    "nic", "nac_v", "nac_p",
    "trajectory_smoothness", "altitude_jitter",
    "callsign_country_match",
]

# Trajectory window for LSTM-AE (lat, lon, alt, vel, hdg) × 16 timesteps.
LSTM_TRAJ_LEN = 16
LSTM_TRAJ_DIM = 5

THRESHOLDS = {
    "texbat": 0.5,
    "aissou": 0.5,
    "iforest_v1": 0.0,
    "iforest_v2": 0.0,
    "lstm_ae": 0.5,
    "opensky_ensemble": 1.0,
}

MODEL_VERSIONS = {
    "texbat": "texbat-xgb-v1",
    "aissou": "aissou-xgb-bin-v1",
    "iforest_v1": "opensky-iforest-v1",
    "iforest_v2": "opensky-iforest-v2-multitime",
    "lstm_ae": "lstm-ae-trajectories-v1",
    "opensky_ensemble": "opensky-ensemble-v1",
}

F1_SCORES = {
    "texbat": 0.984,
    "aissou": 0.976,
    "iforest_v1": 0.789,
    "iforest_v2": 0.743,
    "lstm_ae": 0.935,
    "opensky_ensemble": 0.935,
}
