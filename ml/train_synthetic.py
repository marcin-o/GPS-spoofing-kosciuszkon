"""Train tiny synthetic stand-in models for the demo pipeline.

These are NOT the real production models referenced in the PRD. They are
small classifiers/AEs trained on procedurally-generated data so that the
inference pipeline is end-to-end real (real joblib + real torch state-dicts)
without requiring access to the proprietary TEXBAT / Aissou datasets.

The training is fully deterministic (fixed seed) so model versions and
F1 numbers are stable across runs.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

import joblib
import numpy as np

from ml.schemas import (
    AISSOU_FEATURES,
    LSTM_TRAJ_DIM,
    LSTM_TRAJ_LEN,
    OPENSKY_FEATURES,
    TEXBAT_FEATURES,
)

logger = logging.getLogger(__name__)

SEED = 1337
MODELS_DIR = Path(os.environ.get("GPS_SENTINEL_MODELS",
                                 str(Path(__file__).resolve().parents[1] / "models")))


def _ensure_dir() -> Path:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    return MODELS_DIR


def _make_texbat_dataset(n: int = 3000) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(SEED)
    n_clean = n // 2
    n_spoof = n - n_clean

    clean = rng.normal(0, 1, size=(n_clean, len(TEXBAT_FEATURES)))
    clean[:, TEXBAT_FEATURES.index("cn0_mean")] = rng.normal(45, 2, n_clean)
    clean[:, TEXBAT_FEATURES.index("cn0_std")] = rng.normal(2.5, 0.5, n_clean)
    clean[:, TEXBAT_FEATURES.index("agc_mean")] = rng.normal(0.4, 0.05, n_clean)
    clean[:, TEXBAT_FEATURES.index("pseudorange_residual_mean")] = rng.normal(0, 5, n_clean)

    spoof = rng.normal(0, 1, size=(n_spoof, len(TEXBAT_FEATURES)))
    spoof[:, TEXBAT_FEATURES.index("cn0_mean")] = rng.normal(48, 1.5, n_spoof)
    spoof[:, TEXBAT_FEATURES.index("cn0_std")] = rng.normal(0.6, 0.2, n_spoof)
    spoof[:, TEXBAT_FEATURES.index("agc_mean")] = rng.normal(0.7, 0.08, n_spoof)
    spoof[:, TEXBAT_FEATURES.index("pseudorange_residual_mean")] = rng.normal(80, 25, n_spoof)
    spoof[:, TEXBAT_FEATURES.index("doppler_residual")] = rng.normal(40, 12, n_spoof)
    spoof[:, TEXBAT_FEATURES.index("multipath_indicator")] = rng.normal(0.8, 0.15, n_spoof)

    X = np.vstack([clean, spoof]).astype(np.float32)
    y = np.concatenate([np.zeros(n_clean), np.ones(n_spoof)]).astype(int)
    perm = rng.permutation(len(y))
    return X[perm], y[perm]


def _make_aissou_dataset(n: int = 3000) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(SEED + 1)
    d = len(AISSOU_FEATURES)  # 80
    n_clean = n // 2
    clean = rng.normal(0, 1, size=(n_clean, d))
    spoof = rng.normal(0, 1, size=(n - n_clean, d))
    # Spoof attacks affect a subset of channels strongly: ch3, ch5
    affected_idx = []
    for ch in (3, 5):
        for m in ("cn0", "doppler", "residual", "variance"):
            affected_idx.append(AISSOU_FEATURES.index(f"ch{ch}_{m}"))
    spoof[:, affected_idx] += rng.normal(3.0, 0.6, size=(spoof.shape[0], len(affected_idx)))
    X = np.vstack([clean, spoof]).astype(np.float32)
    y = np.concatenate([np.zeros(n_clean), np.ones(n - n_clean)]).astype(int)
    perm = rng.permutation(len(y))
    return X[perm], y[perm]


def _make_opensky_dataset(n: int = 4000) -> np.ndarray:
    """Anomaly-detection training: only normal points (unlabelled)."""
    rng = np.random.default_rng(SEED + 2)
    d = len(OPENSKY_FEATURES)
    X = rng.normal(0, 1, size=(n, d))
    X[:, OPENSKY_FEATURES.index("velocity")] = rng.normal(220, 30, n)
    X[:, OPENSKY_FEATURES.index("alt")] = rng.normal(10000, 1500, n)
    X[:, OPENSKY_FEATURES.index("trajectory_smoothness")] = rng.normal(0.9, 0.05, n)
    X[:, OPENSKY_FEATURES.index("nic")] = rng.normal(8, 0.5, n)
    return X.astype(np.float32)


def _make_lstm_dataset(n: int = 1500) -> np.ndarray:
    """Smooth normal trajectories for LSTM-AE training."""
    rng = np.random.default_rng(SEED + 3)
    out = np.zeros((n, LSTM_TRAJ_LEN, LSTM_TRAJ_DIM), dtype=np.float32)
    for i in range(n):
        lat0 = rng.uniform(48, 56)
        lon0 = rng.uniform(10, 25)
        hdg = rng.uniform(0, 360)
        vel = rng.uniform(180, 260)
        for t in range(LSTM_TRAJ_LEN):
            lat = lat0 + 0.0008 * t * np.cos(np.radians(hdg))
            lon = lon0 + 0.0008 * t * np.sin(np.radians(hdg))
            alt = 10000 + rng.normal(0, 30)
            v = vel + rng.normal(0, 2)
            h = hdg + rng.normal(0, 0.3)
            out[i, t] = [lat, lon, alt, v, h]
    # Normalize per-feature.
    return out


def train_texbat() -> dict:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import f1_score
    from xgboost import XGBClassifier

    X, y = _make_texbat_dataset()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=SEED)
    clf = XGBClassifier(
        n_estimators=80, max_depth=4, learning_rate=0.15,
        eval_metric="logloss", random_state=SEED, n_jobs=1,
    )
    clf.fit(X_tr, y_tr)
    f1 = f1_score(y_te, clf.predict(X_te))
    out = _ensure_dir() / "texbat_xgb_v1.joblib"
    joblib.dump({"model": clf, "features": TEXBAT_FEATURES,
                 "version": "texbat-xgb-v1", "f1": float(f1)}, out)
    logger.info("trained texbat-xgb-v1: f1=%.3f → %s", f1, out)
    return {"version": "texbat-xgb-v1", "f1": float(f1), "path": str(out)}


def train_aissou() -> dict:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import f1_score
    from xgboost import XGBClassifier

    X, y = _make_aissou_dataset()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=SEED)
    clf = XGBClassifier(
        n_estimators=120, max_depth=5, learning_rate=0.12,
        eval_metric="logloss", random_state=SEED, n_jobs=1,
    )
    clf.fit(X_tr, y_tr)
    f1 = f1_score(y_te, clf.predict(X_te))
    out = _ensure_dir() / "aissou_xgb_bin_v1.joblib"
    joblib.dump({"model": clf, "features": AISSOU_FEATURES,
                 "version": "aissou-xgb-bin-v1", "f1": float(f1)}, out)
    logger.info("trained aissou-xgb-bin-v1: f1=%.3f → %s", f1, out)
    return {"version": "aissou-xgb-bin-v1", "f1": float(f1), "path": str(out)}


def train_iforest(version_tag: str, contamination: float, n_est: int) -> dict:
    from sklearn.ensemble import IsolationForest
    X = _make_opensky_dataset()
    clf = IsolationForest(
        n_estimators=n_est, contamination=contamination,
        random_state=SEED, n_jobs=1,
    )
    clf.fit(X)
    out = _ensure_dir() / f"opensky_{version_tag}.joblib"
    joblib.dump({"model": clf, "features": OPENSKY_FEATURES,
                 "version": f"opensky-{version_tag}"}, out)
    logger.info("trained opensky-%s → %s", version_tag, out)
    return {"version": f"opensky-{version_tag}", "path": str(out)}


def train_lstm_ae() -> dict:
    import torch
    from torch import nn

    torch.manual_seed(SEED)

    class LSTMAE(nn.Module):
        def __init__(self, dim: int = LSTM_TRAJ_DIM, hidden: int = 16):
            super().__init__()
            self.encoder = nn.LSTM(dim, hidden, batch_first=True)
            self.decoder = nn.LSTM(hidden, dim, batch_first=True)

        def forward(self, x):
            _, (h, _) = self.encoder(x)
            seq_len = x.shape[1]
            repeated = h[-1].unsqueeze(1).repeat(1, seq_len, 1)
            out, _ = self.decoder(repeated)
            return out

    X = _make_lstm_dataset()
    # Normalize.
    mean = X.reshape(-1, LSTM_TRAJ_DIM).mean(0)
    std = X.reshape(-1, LSTM_TRAJ_DIM).std(0) + 1e-6
    Xn = (X - mean) / std
    t = torch.tensor(Xn)

    model = LSTMAE()
    opt = torch.optim.Adam(model.parameters(), lr=5e-3)
    loss_fn = nn.MSELoss()
    model.train()
    for epoch in range(20):
        idx = torch.randperm(t.shape[0])[:256]
        batch = t[idx]
        opt.zero_grad()
        out = model(batch)
        loss = loss_fn(out, batch)
        loss.backward()
        opt.step()

    model.eval()
    with torch.no_grad():
        recon = model(t)
        err = ((recon - t) ** 2).mean(dim=(1, 2)).numpy()
    threshold = float(np.percentile(err, 95))
    out_path = _ensure_dir() / "lstm_ae_v1.pt"
    torch.save({
        "state_dict": model.state_dict(),
        "mean": mean.tolist(),
        "std": std.tolist(),
        "threshold": threshold,
        "hidden": 16,
        "dim": LSTM_TRAJ_DIM,
        "seq_len": LSTM_TRAJ_LEN,
        "version": "lstm-ae-trajectories-v1",
    }, out_path)
    logger.info("trained lstm-ae-trajectories-v1: thr=%.4f → %s", threshold, out_path)
    return {"version": "lstm-ae-trajectories-v1",
            "threshold": threshold, "path": str(out_path)}


def train_all() -> dict:
    np.random.seed(SEED)
    results = {
        "texbat": train_texbat(),
        "aissou": train_aissou(),
        "iforest_v1": train_iforest("iforest-v1", contamination=0.05, n_est=80),
        "iforest_v2": train_iforest("iforest-v2-multitime",
                                    contamination=0.08, n_est=120),
        "lstm_ae": train_lstm_ae(),
    }
    return results


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    res = train_all()
    for k, v in res.items():
        print(f"  {k:12s} → {v}")
