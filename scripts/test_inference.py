"""Tiny smoke-test for ml.inference.score() — exercise each scenario."""
from ml.inference import score
from ml.schemas import TEXBAT_FEATURES, AISSOU_FEATURES, OPENSKY_FEATURES, LSTM_TRAJ_LEN

t = score("texbat", {f: 0.0 for f in TEXBAT_FEATURES})
print("texbat   :", t["model_version"], "ratio=", round(t["ratio"], 3))

a = score("aissou", {f: 0.0 for f in AISSOU_FEATURES})
print("aissou   :", a["model_version"], "ratio=", round(a["ratio"], 3))

p = {f: 0.0 for f in OPENSKY_FEATURES}
p["trajectory"] = [[54.0, 18.0, 10000, 230, 90]] * LSTM_TRAJ_LEN
o = score("opensky_ensemble", p)
print("opensky  :", o["model_version"], "ratio=", round(o["ratio"], 3),
      "dominant=", o["dominant_submodel"])
print("OK")
