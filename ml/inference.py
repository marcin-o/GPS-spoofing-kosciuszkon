"""GPS Spoofing Sentinel — unified ML inference API.

Five trained models (defense in depth):

  L1 texbat            XGBoost on TEXBAT receiver observables (F1=0.984 on ds7 OOD)
  L2 aissou            XGBoost on Aissou per-channel features (F1=0.976)
  L3v1 opensky         IsolationForest on single-snapshot OpenSky state vectors (F1=0.789)
  L3v2 opensky_multi   IsolationForest on multi-time trajectory features (F1=0.743) — catches teleport
  L4   lstm_ae         LSTM-Autoencoder unsupervised on trajectories (F1=0.935)

  + score_opensky_ensemble(snapshots) → OR(predictions), max(score/threshold) across L3v1+L3v2+L4

Backend usage:
    from ml.inference import score_opensky_ensemble
    result = score_opensky_ensemble(multi_time_snapshots_df)
    # {'aircraft': [icao24, ...], 'scores': {...per-model...}, 'predictions': {...},
    #  'ensemble_pred': [0/1], 'ensemble_score': [...]}
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd

try:
    import torch
    import torch.nn as _nn
    _HAS_TORCH = True
except ImportError:
    _HAS_TORCH = False

MODELS_DIR = Path(os.environ.get(
    'GPS_SENTINEL_MODELS',
    '/net/afscra/people/plgmateuszoracz/hackathon/models',
))

_MODEL_FILES = {
    'texbat':         'xgboost_texbat_v1.joblib',
    'aissou':         'xgboost_aissou_binary.joblib',
    'opensky':        'isoforest_opensky_v1.joblib',
    'opensky_multi':  'isoforest_opensky_v2_multitime.joblib',
    'lstm_ae':        'lstm_ae_trajectories_v1.pt',
}

_loaded: dict[str, dict] = {}


def load_model(name: str) -> dict:
    if name not in _MODEL_FILES:
        raise ValueError(f'unknown model {name!r}, expected one of {list(_MODEL_FILES)}')
    if name not in _loaded:
        path = MODELS_DIR / _MODEL_FILES[name]
        if not path.exists():
            raise FileNotFoundError(f'model not found at {path}; set $GPS_SENTINEL_MODELS to override')
        if path.suffix == '.pt':
            if not _HAS_TORCH:
                raise ImportError('PyTorch is required for LSTM-AE; install torch first')
            bundle = torch.load(path, map_location='cpu', weights_only=False)
            arch = bundle['arch']
            model = _LSTMAutoencoder(arch['input_dim'], arch['hidden_dim'], arch['latent_dim'])
            model.load_state_dict(bundle['state_dict'])
            model.eval()
            bundle['model'] = model
            _loaded[name] = bundle
        else:
            _loaded[name] = joblib.load(path)
    return _loaded[name]


def _zscore_against_baseline(X: pd.DataFrame, baseline: pd.DataFrame) -> pd.DataFrame:
    m = baseline.mean()
    s = baseline.std().replace(0, 1).fillna(1)
    return (X - m) / s


# ---------- LSTM Autoencoder (must match nb 05 architecture) ----------

if _HAS_TORCH:
    class _LSTMAutoencoder(_nn.Module):
        def __init__(self, input_dim: int, hidden_dim: int = 64, latent_dim: int = 32, n_layers: int = 1):
            super().__init__()
            self.encoder = _nn.LSTM(input_dim, hidden_dim, n_layers, batch_first=True)
            self.to_latent = _nn.Linear(hidden_dim, latent_dim)
            self.from_latent = _nn.Linear(latent_dim, hidden_dim)
            self.decoder = _nn.LSTM(hidden_dim, hidden_dim, n_layers, batch_first=True)
            self.out = _nn.Linear(hidden_dim, input_dim)

        def forward(self, x):  # type: ignore[override]
            _, (h_n, _) = self.encoder(x)
            z = self.to_latent(h_n[-1])
            T = x.size(1)
            h_dec = self.from_latent(z).unsqueeze(1).repeat(1, T, 1)
            dec_out, _ = self.decoder(h_dec)
            return self.out(dec_out)


# ---------- TEXBAT (L1) ----------

def score_texbat(
    features_df: pd.DataFrame,
    baseline_window: tuple[int, int] = (30, 100),
    t_col: str = 't_int',
    threshold: Optional[float] = None,
) -> dict[str, Any]:
    """Score TEXBAT-style per-second receiver features."""
    bundle = load_model('texbat')
    feat_cols = bundle['feature_cols']
    thr = threshold if threshold is not None else bundle.get('threshold', 0.05)

    if t_col not in features_df.columns:
        raise ValueError(f'features_df must have column {t_col!r} (per-second index)')
    missing = [c for c in feat_cols if c not in features_df.columns]
    if missing:
        raise ValueError(f'features_df missing columns: {missing}')

    lo, hi = baseline_window
    baseline = features_df.loc[
        (features_df[t_col] >= lo) & (features_df[t_col] < hi), feat_cols
    ]
    if len(baseline) < 5:
        return {'error': f'insufficient baseline samples ({len(baseline)} < 5) in window {baseline_window}'}

    Xz = _zscore_against_baseline(features_df[feat_cols], baseline)
    proba = bundle['model'].predict_proba(Xz)[:, 1]
    pred = (proba >= thr).astype(int)
    return {
        'scores':         proba.tolist(),
        'predictions':    pred.tolist(),
        'threshold':      float(thr),
        'baseline_window': baseline_window,
        'baseline_n_samples': int(len(baseline)),
        'model_version':  'texbat-xgb-v1',
        'training_metrics': bundle.get('metrics', {}),
    }


# ---------- Aissou (L2) ----------

def score_aissou(features_df: pd.DataFrame, threshold: float = 0.5) -> dict[str, Any]:
    """Score Aissou-style per-row 80 features (12 metrics × 8 channels)."""
    bundle = load_model('aissou')
    feat_cols = bundle['feature_cols']
    missing = [c for c in feat_cols if c not in features_df.columns]
    if missing:
        raise ValueError(f'features_df missing columns: {missing[:5]}{"..." if len(missing)>5 else ""}')
    X = features_df[feat_cols].astype(np.float32)
    proba = bundle['model'].predict_proba(X)[:, 1]
    pred = (proba >= threshold).astype(int)
    return {
        'scores':         proba.tolist(),
        'predictions':    pred.tolist(),
        'threshold':      threshold,
        'model_version':  'aissou-xgb-binary-v1',
        'training_metrics': bundle.get('metrics', {}),
    }


# ---------- OpenSky single-snapshot (L3v1) ----------

OPENSKY_RAW_COLS = ['icao24', 'callsign', 'origin_country', 'time_position', 'last_contact',
                   'longitude', 'latitude', 'baro_altitude', 'on_ground', 'velocity', 'true_track',
                   'vertical_rate', 'sensors', 'geo_altitude', 'squawk', 'spi', 'position_source']


def extract_opensky_features(states_df: pd.DataFrame) -> pd.DataFrame:
    """Build per-state-vector feature matrix matching opensky single-snapshot model input."""
    needed = ['latitude', 'longitude', 'baro_altitude', 'velocity', 'true_track']
    missing = [c for c in needed if c not in states_df.columns]
    if missing:
        raise ValueError(f'states_df missing required columns: {missing}')

    df = states_df.dropna(subset=needed).reset_index(drop=True)
    out = pd.DataFrame(index=df.index)
    out['velocity_mps']      = df['velocity'].fillna(0)
    out['baro_altitude_m']   = df['baro_altitude'].fillna(0)
    out['geo_altitude_m']    = df.get('geo_altitude', df['baro_altitude']).fillna(df['baro_altitude'].fillna(0))
    out['vertical_rate_mps'] = df.get('vertical_rate', pd.Series(0, index=df.index)).fillna(0)
    track_rad = np.radians(df['true_track'].fillna(0))
    out['track_sin'] = np.sin(track_rad)
    out['track_cos'] = np.cos(track_rad)
    out['vel_north'] = out['velocity_mps'] * out['track_cos']
    out['vel_east']  = out['velocity_mps'] * out['track_sin']
    on_ground = df.get('on_ground', pd.Series(False, index=df.index)).astype(bool)
    out['on_ground'] = on_ground.astype(int)
    out['onground_high_alt'] = ((on_ground) & (df['baro_altitude'].fillna(0) > 200)).astype(int)
    out['onground_high_vel'] = ((on_ground) & (df['velocity'].fillna(0) > 50)).astype(int)
    out['alt_baro_geo_diff'] = (out['geo_altitude_m'] - out['baro_altitude_m'])
    out['cruise_vrate'] = ((out['baro_altitude_m'] > 9000) & (out['vertical_rate_mps'].abs() > 5)).astype(int)
    out['vel_alt_ratio'] = out['velocity_mps'] / (out['baro_altitude_m'] + 1)
    pos_src = df.get('position_source', pd.Series(-1, index=df.index)).fillna(-1)
    out['source_adsb'] = (pos_src == 0).astype(int)
    out['source_mlat'] = (pos_src == 2).astype(int)
    snap_t = df['snapshot_time'].iloc[0] if 'snapshot_time' in df.columns else df['last_contact'].max()
    out['last_contact_age_s'] = snap_t - df.get('last_contact', pd.Series(snap_t, index=df.index)).fillna(snap_t)
    out['position_age_s'] = snap_t - df.get('time_position', pd.Series(snap_t, index=df.index)).fillna(snap_t)
    return out


def score_opensky(states_df: pd.DataFrame) -> dict[str, Any]:
    """Score raw OpenSky state vectors (single snapshot)."""
    bundle = load_model('opensky')
    X = extract_opensky_features(states_df)
    X = X[bundle['feature_cols']]
    scores = (-bundle['model'].score_samples(X)).tolist()
    preds = (bundle['model'].predict(X) == -1).astype(int).tolist()
    return {
        'scores':        scores,
        'predictions':   preds,
        'kept_indices':  X.index.tolist(),
        'model_version': 'opensky-iforest-v1',
        'training_metrics': bundle.get('eval_metrics', {}),
    }


# ---------- OpenSky multi-time (L3v2) ----------

def _haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1 = np.radians(lat1); p2 = np.radians(lat2)
    dp = np.radians(lat2 - lat1); dl = np.radians(lon2 - lon1)
    a = np.sin(dp/2)**2 + np.cos(p1) * np.cos(p2) * np.sin(dl/2)**2
    return 2 * R * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def _heading_diff_deg(h1, h2):
    d = np.abs(h1 - h2) % 360
    return np.minimum(d, 360 - d)


def extract_trajectory_features(snapshots_df: pd.DataFrame) -> pd.DataFrame:
    """Build per-aircraft trajectory features from multi-time snapshots.

    Input: long-format DataFrame with rows for each (aircraft, snapshot) pair.
    Required columns: icao24, snapshot_idx (or snapshot_time), latitude, longitude,
                      baro_altitude, velocity, true_track, vertical_rate, on_ground.
    Returns: DataFrame indexed by icao24 with 17 trajectory features.
    Aircraft with <4 snapshots are dropped.
    """
    needed = ['icao24', 'latitude', 'longitude', 'baro_altitude', 'velocity', 'true_track', 'vertical_rate']
    missing = [c for c in needed if c not in snapshots_df.columns]
    if missing:
        raise ValueError(f'snapshots_df missing columns: {missing}')

    sort_col = 'snapshot_idx' if 'snapshot_idx' in snapshots_df.columns else 'snapshot_time'
    if sort_col not in snapshots_df.columns:
        raise ValueError("snapshots_df needs 'snapshot_idx' or 'snapshot_time' column")

    valid_rows = snapshots_df.dropna(subset=['latitude', 'longitude', 'baro_altitude', 'velocity', 'true_track'])
    if 'on_ground' in valid_rows.columns:
        valid_rows = valid_rows[~valid_rows['on_ground'].astype(bool)]
    snap_counts = valid_rows.groupby('icao24').size()
    keep = snap_counts[snap_counts >= 4].index
    valid = valid_rows[valid_rows['icao24'].isin(keep)].sort_values(['icao24', sort_col]).reset_index(drop=True)

    feats_list = []
    for icao, g in valid.groupby('icao24'):
        g = g.sort_values(sort_col)
        lat, lon = g['latitude'].values, g['longitude'].values
        alt = g['baro_altitude'].values
        vel, hdg = g['velocity'].values, g['true_track'].values
        vrate = g['vertical_rate'].fillna(0).values
        if 'snapshot_time' in g.columns:
            times = g['snapshot_time'].values
        else:
            times = g[sort_col].values * 15.0  # fallback assume 15s intervals
        n = len(g)
        if n < 2:
            continue
        step_dist = _haversine_m(lat[:-1], lon[:-1], lat[1:], lon[1:])
        step_time = np.diff(times)
        step_time = np.where(step_time == 0, 15.0, step_time)
        step_speed = step_dist / step_time
        speed_residual = np.abs(step_speed - vel[:-1])
        alt_diff = np.diff(alt)
        predicted_alt_diff = vrate[:-1] * step_time
        alt_residual = np.abs(alt_diff - predicted_alt_diff)
        hdg_changes = _heading_diff_deg(hdg[:-1], hdg[1:])
        on_ground_last = int(g['on_ground'].iloc[-1]) if 'on_ground' in g.columns else 0
        feats_list.append({
            'icao24':                  icao,
            'max_step_dist_m':         float(step_dist.max()),
            'mean_step_dist_m':        float(step_dist.mean()),
            'step_dist_std_m':         float(step_dist.std()),
            'max_step_speed_mps':      float(step_speed.max()),
            'mean_step_speed_mps':     float(step_speed.mean()),
            'speed_residual_max_mps':  float(speed_residual.max()),
            'speed_residual_mean_mps': float(speed_residual.mean()),
            'alt_residual_max_m':      float(alt_residual.max()),
            'alt_residual_mean_m':     float(alt_residual.mean()),
            'hdg_change_max_deg':      float(hdg_changes.max()),
            'hdg_change_total_deg':    float(hdg_changes.sum()),
            'vel_var':                 float(vel.var()),
            'alt_var':                 float(alt.var()),
            'last_velocity':           float(vel[-1]),
            'last_baro_altitude':      float(alt[-1]),
            'last_vertical_rate':      float(vrate[-1]),
            'last_on_ground':          on_ground_last,
        })
    if not feats_list:
        return pd.DataFrame()
    return pd.DataFrame(feats_list).set_index('icao24')


def score_opensky_multitime(snapshots_df: pd.DataFrame) -> dict[str, Any]:
    """Score multi-time OpenSky snapshots (≥4 per aircraft)."""
    bundle = load_model('opensky_multi')
    feats = extract_trajectory_features(snapshots_df)
    if feats.empty:
        return {'error': 'no aircraft with >=4 valid snapshots', 'aircraft': [], 'scores': [], 'predictions': []}
    X = feats[bundle['feature_cols']].fillna(0).astype(np.float32)
    scores = (-bundle['model'].score_samples(X)).tolist()
    preds = (bundle['model'].predict(X) == -1).astype(int).tolist()
    return {
        'aircraft':      X.index.tolist(),
        'scores':        scores,
        'predictions':   preds,
        'model_version': 'opensky-iforest-multitime-v2',
        'training_metrics': bundle.get('eval_metrics', {}),
    }


# ---------- LSTM-AE (L4) ----------

def _build_trajectory_tensor(snapshots_df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    """Stitch multi-time snapshots into (N, T, 6) raw trajectory array.

    Uses the latest 8 snapshots per aircraft (or pad/truncate to T=8).
    Returns (array, list of icao24 in row order).
    """
    valid_rows = snapshots_df.dropna(subset=['latitude', 'longitude', 'baro_altitude', 'velocity', 'true_track'])
    if 'on_ground' in valid_rows.columns:
        valid_rows = valid_rows[~valid_rows['on_ground'].astype(bool)]
    sort_col = 'snapshot_idx' if 'snapshot_idx' in valid_rows.columns else 'snapshot_time'
    snap_counts = valid_rows.groupby('icao24').size()
    keep = snap_counts[snap_counts >= 4].index
    valid = valid_rows[valid_rows['icao24'].isin(keep)].sort_values(['icao24', sort_col])

    T = 8
    icaos = []
    trajs = []
    for icao, g in valid.groupby('icao24'):
        g = g.sort_values(sort_col).tail(T)  # latest T snapshots
        lat = g['latitude'].values
        lon = g['longitude'].values
        alt = g['baro_altitude'].values
        vel = g['velocity'].values
        hdg = g['true_track'].values
        n = len(g)
        if n < T:
            # Pad start by repeating earliest snapshot
            pad = T - n
            lat = np.concatenate([np.full(pad, lat[0]), lat])
            lon = np.concatenate([np.full(pad, lon[0]), lon])
            alt = np.concatenate([np.full(pad, alt[0]), alt])
            vel = np.concatenate([np.full(pad, vel[0]), vel])
            hdg = np.concatenate([np.full(pad, hdg[0]), hdg])
        traj = np.zeros((T, 6), dtype=np.float32)
        traj[:, 0] = lat
        traj[:, 1] = lon
        traj[:, 2] = alt
        traj[:, 3] = vel
        traj[:, 4] = np.sin(np.radians(hdg))
        traj[:, 5] = np.cos(np.radians(hdg))
        icaos.append(icao)
        trajs.append(traj)
    if not trajs:
        return np.zeros((0, T, 6), dtype=np.float32), []
    return np.stack(trajs), icaos


def _to_lstm_features(traj: np.ndarray) -> np.ndarray:
    """Replicate nb 05 to_features() — returns (N, T, 8) normalized."""
    N, T, _ = traj.shape
    out = np.zeros((N, T, 8), dtype=np.float32)
    lat0 = traj[:, 0:1, 0:1]
    lat_m = (traj[:, :, 0:1] - lat0) * 111000.0
    lon_m = (traj[:, :, 1:2] - traj[:, 0:1, 1:2]) * 111000.0 * np.cos(np.radians(lat0))
    alt   = traj[:, :, 2:3] / 100.0
    vel   = traj[:, :, 3:4] / 100.0
    out[:, :, 0:1] = lat_m / 1000.0
    out[:, :, 1:2] = lon_m / 1000.0
    out[:, :, 2:3] = alt
    out[:, :, 3:4] = vel
    out[:, :, 4:5] = traj[:, :, 4:5]
    out[:, :, 5:6] = traj[:, :, 5:6]
    out[:, 1:, 6:7] = lat_m[:, 1:, :] - lat_m[:, :-1, :]
    out[:, 1:, 7:8] = lon_m[:, 1:, :] - lon_m[:, :-1, :]
    out = out / np.maximum(np.abs(out).max(axis=(0, 1), keepdims=True), 1e-6)
    return out.astype(np.float32)


def score_lstm_ae(snapshots_df: pd.DataFrame, threshold_mode: str = 'auto') -> dict[str, Any]:
    """Score multi-time OpenSky snapshots with LSTM-AE; per-aircraft reconstruction MSE.

    threshold_mode:
      - 'auto'     (default): use max(training_threshold, batch_p95) for batches ≥50 aircraft.
                              This handles distribution shift (model trained on synthesized
                              trajectories — real data has ~20× higher baseline MSE).
                              For small batches use training threshold (no batch p95 estimable).
      - 'training': always use saved p95 from clean training data
      - 'dynamic':  always use current batch p95 (top-5% rank)
    """
    if not _HAS_TORCH:
        raise ImportError('PyTorch is required for LSTM-AE; install torch first')
    bundle = load_model('lstm_ae')
    model = bundle['model']
    training_threshold = float(bundle['threshold'])

    traj, icaos = _build_trajectory_tensor(snapshots_df)
    if len(icaos) == 0:
        return {'error': 'no aircraft with >=4 valid snapshots', 'aircraft': [], 'scores': [], 'predictions': []}
    X = _to_lstm_features(traj)
    Xt = torch.from_numpy(X)
    with torch.no_grad():
        rec = model(Xt)
        mse = ((rec - Xt) ** 2).mean(dim=(1, 2)).numpy()

    batch_p95 = float(np.percentile(mse, 95)) if len(mse) >= 5 else None
    if threshold_mode == 'training' or batch_p95 is None:
        threshold_used = training_threshold
        mode_used = 'training'
    elif threshold_mode == 'dynamic' or len(mse) >= 50:
        threshold_used = max(training_threshold, batch_p95)
        mode_used = 'dynamic_p95' if batch_p95 > training_threshold else 'training'
    else:
        threshold_used = training_threshold
        mode_used = 'training'

    pred = (mse > threshold_used).astype(int)
    return {
        'aircraft':           icaos,
        'scores':             mse.tolist(),
        'predictions':        pred.tolist(),
        'threshold':          float(threshold_used),
        'training_threshold': training_threshold,
        'batch_p95':          batch_p95,
        'threshold_mode':     mode_used,
        'model_version':      'lstm-ae-trajectories-v1',
        'training_metrics':   bundle.get('eval', {}),
    }


# ---------- Ensemble ----------

def score_opensky_ensemble(snapshots_df: pd.DataFrame, *, use_lstm_ae: bool = True) -> dict[str, Any]:
    """Ensemble L3v1 + L3v2 + (optionally) L4 LSTM-AE on multi-time OpenSky snapshots.

    Each aircraft gets predictions from each model. Final:
    - ensemble_pred = OR (any model flags) — maximizes recall, complementary attack coverage
    - ensemble_score = max(score / model_threshold) — normalized cross-model score
    """
    sort_col = 'snapshot_idx' if 'snapshot_idx' in snapshots_df.columns else 'snapshot_time'
    if sort_col not in snapshots_df.columns:
        raise ValueError("snapshots_df needs 'snapshot_idx' or 'snapshot_time' column")

    # L3v1 on latest snapshot per aircraft
    latest_snap = snapshots_df.sort_values(sort_col).groupby('icao24').tail(1).reset_index(drop=True)
    r_v1 = score_opensky(latest_snap)
    v1_aircraft = latest_snap.iloc[r_v1['kept_indices']]['icao24'].tolist()
    v1_score_thresh = 0.5  # IsolationForest predict() uses contamination-based threshold; use ~0.5 for normalization
    v1_by_icao = dict(zip(v1_aircraft, zip(r_v1['scores'], r_v1['predictions'])))

    # L3v2 multi-time
    r_v2 = score_opensky_multitime(snapshots_df)
    v2_by_icao = dict(zip(r_v2.get('aircraft', []), zip(r_v2.get('scores', []), r_v2.get('predictions', []))))

    # L4 LSTM-AE (optional, requires torch)
    v4_by_icao = {}
    v4_threshold = None
    if use_lstm_ae and _HAS_TORCH:
        r_v4 = score_lstm_ae(snapshots_df)
        v4_threshold = r_v4.get('threshold')
        v4_by_icao = dict(zip(r_v4.get('aircraft', []), zip(r_v4.get('scores', []), r_v4.get('predictions', []))))

    # Union all aircraft
    all_aircraft = sorted(set(v1_by_icao) | set(v2_by_icao) | set(v4_by_icao))
    rows = []
    for icao in all_aircraft:
        s1, p1 = v1_by_icao.get(icao, (np.nan, 0))
        s2, p2 = v2_by_icao.get(icao, (np.nan, 0))
        s4, p4 = v4_by_icao.get(icao, (np.nan, 0))
        # Normalized scores for cross-model comparison
        n1 = (s1 / v1_score_thresh) if not np.isnan(s1) else 0.0
        n2 = (s2 / v1_score_thresh) if not np.isnan(s2) else 0.0  # L3v2 same scale as L3v1
        n4 = (s4 / v4_threshold)    if (v4_threshold and not np.isnan(s4)) else 0.0
        ensemble_score = max(n1, n2, n4)
        ensemble_pred = int(p1 or p2 or p4)
        rows.append({
            'icao24':         icao,
            'score_v1':       float(s1) if not np.isnan(s1) else None,
            'pred_v1':        int(p1),
            'score_v2':       float(s2) if not np.isnan(s2) else None,
            'pred_v2':        int(p2),
            'score_lstm_ae':  float(s4) if not np.isnan(s4) else None,
            'pred_lstm_ae':   int(p4),
            'ensemble_score': float(ensemble_score),
            'ensemble_pred':  ensemble_pred,
        })
    df = pd.DataFrame(rows)
    return {
        'per_aircraft':       df.to_dict('records'),
        'aircraft':           df['icao24'].tolist(),
        'ensemble_scores':    df['ensemble_score'].tolist(),
        'ensemble_predictions': df['ensemble_pred'].tolist(),
        'n_flagged_v1':       int(df['pred_v1'].sum()),
        'n_flagged_v2':       int(df['pred_v2'].sum()),
        'n_flagged_lstm_ae':  int(df['pred_lstm_ae'].sum()),
        'n_flagged_ensemble': int(df['ensemble_pred'].sum()),
        'lstm_ae_used':       use_lstm_ae and _HAS_TORCH,
        'model_version':      'opensky-ensemble-v1',
    }


# ---------- Dispatcher ----------

def score(scenario: str, df: pd.DataFrame, **kwargs) -> dict[str, Any]:
    """Single entry-point.

    scenarios:
      'texbat'                  L1 receiver-side (per-second)
      'aissou'                  L2 UAV per-channel
      'opensky'                 L3v1 single-snapshot
      'opensky_multi'           L3v2 multi-time
      'lstm_ae'                 L4 LSTM-Autoencoder
      'opensky_ensemble'        L3v1+L3v2+L4 union
    """
    fn = {
        'texbat':           score_texbat,
        'aissou':           score_aissou,
        'opensky':          score_opensky,
        'opensky_multi':    score_opensky_multitime,
        'lstm_ae':          score_lstm_ae,
        'opensky_ensemble': score_opensky_ensemble,
    }.get(scenario)
    if fn is None:
        raise ValueError(f'unknown scenario {scenario!r}')
    return fn(df, **kwargs)


# ---------- CLI smoke test ----------

if __name__ == '__main__':
    import argparse, sys

    parser = argparse.ArgumentParser(description='Smoke-test inference.py against saved data')
    parser.add_argument('--all', action='store_true', help='run all smoke tests')
    parser.add_argument('--texbat', action='store_true')
    parser.add_argument('--aissou', action='store_true')
    parser.add_argument('--opensky', action='store_true')
    parser.add_argument('--opensky-multi', action='store_true')
    parser.add_argument('--lstm-ae', action='store_true')
    parser.add_argument('--ensemble', action='store_true')
    args = parser.parse_args()
    if not (args.texbat or args.aissou or args.opensky or args.opensky_multi
            or args.lstm_ae or args.ensemble or args.all):
        parser.print_help(); sys.exit(1)

    DATA = Path(os.environ.get(
        'GPS_SENTINEL_DATA',
        '/net/afscra/people/plgmateuszoracz/hackathon/data',
    ))

    if args.texbat or args.all:
        print('=== TEXBAT smoke test ===')
        feat = pd.read_parquet(DATA / 'features' / 'ds7_features.parquet')
        result = score_texbat(feat)
        scores = np.array(result['scores']); preds = np.array(result['predictions'])
        print(f'  scored {len(scores)} rows  (threshold={result["threshold"]})')
        print(f'  spoof: {preds.sum()}/{len(preds)} ({100*preds.mean():.1f}%)')

    if args.aissou or args.all:
        print('=== Aissou smoke test ===')
        flat = pd.read_parquet(DATA / 'features' / 'aissou_flat.parquet')
        sample = flat.sample(min(5000, len(flat)), random_state=42).reset_index(drop=True)
        result = score_aissou(sample)
        preds = np.array(result['predictions'])
        print(f'  scored {len(preds)} rows  spoof: {preds.sum()}/{len(preds)} ({100*preds.mean():.1f}%)')

    if args.opensky or args.all:
        print('=== OpenSky single-snapshot (L3v1) ===')
        states = pd.read_parquet(DATA / 'opensky' / 'opensky_europe_snapshot.parquet')
        result = score_opensky(states)
        preds = np.array(result['predictions'])
        print(f'  scored {len(preds)} aircraft  flagged: {preds.sum()}/{len(preds)} ({100*preds.mean():.1f}%)')

    if args.opensky_multi or args.all:
        print('=== OpenSky multi-time (L3v2) ===')
        snaps = pd.read_parquet(DATA / 'opensky' / 'snapshots_multitime.parquet')
        result = score_opensky_multitime(snaps)
        preds = np.array(result.get('predictions', []))
        print(f'  scored {len(preds)} aircraft  flagged: {preds.sum()}/{len(preds)} ({100*preds.mean():.1f}%)' if len(preds) else f'  {result.get("error")}')

    if args.lstm_ae or args.all:
        print('=== LSTM-AE (L4) ===')
        snaps = pd.read_parquet(DATA / 'opensky' / 'snapshots_multitime.parquet')
        result = score_lstm_ae(snaps)
        preds = np.array(result.get('predictions', []))
        scores_arr = np.array(result.get('scores', []))
        print(f'  scored {len(preds)} aircraft  flagged: {preds.sum()}/{len(preds)} ({100*preds.mean():.1f}%)' if len(preds) else f'  {result.get("error")}')
        if len(scores_arr): print(f'  MSE stats: mean={scores_arr.mean():.5f}, p95={np.percentile(scores_arr,95):.5f}')

    if args.ensemble or args.all:
        print('=== Ensemble (L3v1 + L3v2 + L4) ===')
        snaps = pd.read_parquet(DATA / 'opensky' / 'snapshots_multitime.parquet')
        result = score_opensky_ensemble(snaps)
        n = len(result['aircraft'])
        print(f'  scored {n} aircraft')
        print(f'  flagged: v1={result["n_flagged_v1"]}, v2={result["n_flagged_v2"]}, lstm_ae={result["n_flagged_lstm_ae"]}, ENSEMBLE={result["n_flagged_ensemble"]}')
        ens_arr = np.array(result['ensemble_scores'])
        print(f'  ensemble score stats: mean={ens_arr.mean():.3f}, p95={np.percentile(ens_arr, 95):.3f}, max={ens_arr.max():.3f}')

    print('\nAll smoke tests OK.')
