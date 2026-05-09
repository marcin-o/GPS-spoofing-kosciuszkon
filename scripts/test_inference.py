"""Tiny smoke-test for the per-tick scoring layer (backend.app.services.ml_service).

The ML-team's batch API in ``ml.inference`` is exercised by their own
notebook smoke test. This script covers the synthetic stand-ins that
power the live WS replay so we catch shape regressions early.
"""
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services import ml_service  # noqa: E402
from ml.schemas import (  # noqa: E402
    AISSOU_FEATURES,
    LSTM_TRAJ_LEN,
    OPENSKY_FEATURES,
    TEXBAT_FEATURES,
)

t = ml_service.run("texbat", {f: 0.0 for f in TEXBAT_FEATURES})
print("texbat   :", t["model_version"], "ratio=", round(t["ratio"], 3))

a = ml_service.run("aissou", {f: 0.0 for f in AISSOU_FEATURES})
print("aissou   :", a["model_version"], "ratio=", round(a["ratio"], 3))

p = {f: 0.0 for f in OPENSKY_FEATURES}
p["trajectory"] = [[54.0, 18.0, 10000, 230, 90]] * LSTM_TRAJ_LEN
o = ml_service.run("opensky_ensemble", p)
print("opensky  :", o["model_version"], "ratio=", round(o["ratio"], 3),
      "dominant=", o["dominant_submodel"])
print("OK")
