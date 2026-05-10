#!/usr/bin/env python3
"""Export TEXBAT and AISSOU XGBoost classifiers from joblib bundles to ONNX.

Each model exports in its own subprocess invocation to avoid the known
joblib double-load segfault we observed on xgboost 2.1.3 + Python 3.10.

Outputs (all under gnss-defense-edge/):
  - assets/texbat_l1.onnx     Pipeline(StandardScaler[t_int∈[30,100)], XGBClassifier)
  - assets/aissou_l2.onnx     XGBClassifier (no preprocessing)
  - assets/model_schema.json  feature counts + thresholds + baseline scenario
  - tests/parity_fixture.csv  100 rows of features + python-computed probs
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
EDGE_ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = REPO_ROOT / "models"
SCENARIOS_DIR = REPO_ROOT / "backend" / "app" / "scenarios"
ASSETS_DIR = EDGE_ROOT / "assets"
TESTS_DIR = EDGE_ROOT / "tests"

TEXBAT_JOBLIB = MODELS_DIR / "xgboost_texbat_v1.joblib"
AISSOU_JOBLIB = MODELS_DIR / "xgboost_aissou_binary.joblib"
BASELINE_SCENARIO = SCENARIOS_DIR / "normal_waw_gdn.csv"
BASELINE_T_INT = (30, 100)


def register_xgb_converter() -> None:
    from skl2onnx import update_registered_converter
    from skl2onnx.common.shape_calculator import (
        calculate_linear_classifier_output_shapes,
    )
    from onnxmltools.convert.xgboost.operator_converters.XGBoost import (
        convert_xgboost as convert_xgb_op,
    )
    from xgboost import XGBClassifier

    update_registered_converter(
        XGBClassifier,
        "XGBoostXGBClassifier",
        calculate_linear_classifier_output_shapes,
        convert_xgb_op,
        options={"nocl": [True, False], "zipmap": [True, False, "columns"]},
    )


def _stub_feature_names(clf) -> None:
    """onnxmltools' XGBoost converter chokes on real feature names like
    'power_2MHz' (it parses tree dumps that use them as splits and tries
    int(float(name))). Reset to f0..fN before conversion. Doesn't affect
    inference numerics — feature order is preserved by position."""
    booster = clf.get_booster()
    n = booster.num_features() if hasattr(booster, "num_features") else None
    if n is None:
        n = len(booster.feature_names or [])
    booster.feature_names = [f"f{i}" for i in range(n)]


def export_texbat() -> None:
    print(f"[texbat] loading {TEXBAT_JOBLIB.name}")
    bundle = joblib.load(TEXBAT_JOBLIB)
    clf = bundle["model"]
    feature_cols: list[str] = list(bundle["feature_cols"])
    threshold = float(bundle.get("threshold") or 0.05)
    print(f"[texbat] {len(feature_cols)} features, threshold={threshold}")
    _stub_feature_names(clf)

    print(f"[texbat] fitting StandardScaler from {BASELINE_SCENARIO.name} t_int∈[{BASELINE_T_INT[0]},{BASELINE_T_INT[1]})")
    df = pd.read_csv(BASELINE_SCENARIO)
    base = df[(df["t_int"] >= BASELINE_T_INT[0]) & (df["t_int"] < BASELINE_T_INT[1])][feature_cols]
    if base.empty:
        raise RuntimeError("baseline window is empty — wrong scenario?")
    print(f"[texbat] baseline rows: {len(base)}; mean[0..3]={base.mean().values[:3]}")

    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    scaler = StandardScaler().fit(base.values.astype(np.float32))
    pipeline = Pipeline([("scaler", scaler), ("clf", clf)])

    register_xgb_converter()
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType

    initial_types = [("input", FloatTensorType([None, len(feature_cols)]))]
    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_types,
        options={id(pipeline): {"zipmap": False}},
        target_opset={"": 18, "ai.onnx.ml": 3},
    )

    out = ASSETS_DIR / "texbat_l1.onnx"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(onnx_model.SerializeToString())
    print(f"[texbat] wrote {out} ({out.stat().st_size // 1024} KB)")

    parity_smoke(pipeline, out, len(feature_cols), label="texbat")
    return {
        "n_features": len(feature_cols),
        "threshold": threshold,
        "feature_cols": feature_cols,
        "baseline_scenario": BASELINE_SCENARIO.name,
        "baseline_t_int": list(BASELINE_T_INT),
    }


def export_aissou() -> None:
    print(f"[aissou] loading {AISSOU_JOBLIB.name}")
    bundle = joblib.load(AISSOU_JOBLIB)
    clf = bundle["model"]
    feature_cols: list[str] = list(bundle["feature_cols"])
    threshold = bundle.get("threshold")
    if threshold is None:
        threshold = 0.5
        note = "default 0.5 (joblib has no calibrated threshold)"
    else:
        note = "from joblib"
    threshold = float(threshold)
    print(f"[aissou] {len(feature_cols)} features, threshold={threshold} ({note})")
    _stub_feature_names(clf)

    register_xgb_converter()
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType

    initial_types = [("input", FloatTensorType([None, len(feature_cols)]))]
    onnx_model = convert_sklearn(
        clf,
        initial_types=initial_types,
        options={id(clf): {"zipmap": False}},
        target_opset={"": 18, "ai.onnx.ml": 3},
    )

    out = ASSETS_DIR / "aissou_l2.onnx"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(onnx_model.SerializeToString())
    print(f"[aissou] wrote {out} ({out.stat().st_size // 1024} KB)")

    parity_smoke(clf, out, len(feature_cols), label="aissou")
    return {
        "n_features": len(feature_cols),
        "threshold": threshold,
        "threshold_source": note,
        "feature_cols": feature_cols,
    }


def parity_smoke(model, onnx_path: Path, n_features: int, *, label: str) -> None:
    import onnxruntime as ort

    rng = np.random.default_rng(42)
    X = rng.standard_normal((10, n_features)).astype(np.float32)

    # Manual step-by-step to bypass sklearn 1.6's __sklearn_tags__ check that
    # xgboost 2.1.3's XGBClassifier doesn't satisfy.
    from sklearn.pipeline import Pipeline
    if isinstance(model, Pipeline):
        Xp = X
        for _, step in model.steps[:-1]:
            Xp = step.transform(Xp)
        py_proba = model.steps[-1][1].predict_proba(Xp)[:, 1]
    else:
        py_proba = model.predict_proba(X)[:, 1]

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    out = sess.run(None, {"input": X})
    onnx_proba = np.asarray(out[1])
    if onnx_proba.ndim == 2 and onnx_proba.shape[1] == 2:
        onnx_proba = onnx_proba[:, 1]
    else:
        raise RuntimeError(f"[{label}] unexpected ONNX prob shape: {onnx_proba.shape}")

    diff = np.abs(py_proba - onnx_proba)
    print(f"[{label}] parity smoke: max diff = {diff.max():.2e}, mean = {diff.mean():.2e}")
    assert diff.max() < 1e-5, f"[{label}] parity broken — max diff {diff.max()}"


def build_fixture(rows_per_scenario: int = 35) -> None:
    """Generate tests/parity_fixture.csv from existing ONNX files.

    Loads BOTH ONNX models via onnxruntime (no joblib here, so no segfault risk)
    and records (features..., prob_l1, prob_l2, ratio_l1, ratio_l2, verdict)
    per row. Rust's parity test re-runs ONNX inference against the same row
    and asserts max abs diff < 1e-4 on prob_l1, prob_l2.
    """
    import onnxruntime as ort

    schema_path = ASSETS_DIR / "model_schema.json"
    schema = json.loads(schema_path.read_text())
    texbat_cols: list[str] = schema["texbat"]["feature_cols"]
    aissou_cols: list[str] = schema["aissou"]["feature_cols"]
    t1 = schema["texbat"]["threshold"]
    t2 = schema["aissou"]["threshold"]

    sess_l1 = ort.InferenceSession(str(ASSETS_DIR / "texbat_l1.onnx"),
                                   providers=["CPUExecutionProvider"])
    sess_l2 = ort.InferenceSession(str(ASSETS_DIR / "aissou_l2.onnx"),
                                   providers=["CPUExecutionProvider"])

    scenarios = ["normal_waw_gdn.csv", "texbat_spoof.csv", "aissou_channel_attack.csv"]
    rng = np.random.default_rng(7)
    rows: list[dict] = []
    for name in scenarios:
        df = pd.read_csv(SCENARIOS_DIR / name)
        idx = rng.choice(len(df), size=min(rows_per_scenario, len(df)), replace=False)
        idx.sort()
        sub = df.iloc[idx].reset_index(drop=True)

        X1 = sub[texbat_cols].to_numpy(dtype=np.float32)
        X2 = sub[aissou_cols].to_numpy(dtype=np.float32)

        p1 = np.asarray(sess_l1.run(None, {"input": X1})[1])[:, 1]
        p2 = np.asarray(sess_l2.run(None, {"input": X2})[1])[:, 1]

        for i, (_, src) in enumerate(sub.iterrows()):
            r1 = float(p1[i] / t1) if t1 > 0 else 0.0
            r2 = float(p2[i] / t2) if t2 > 0 else 0.0
            mr = max(r1, r2)
            verdict = "CRITICAL" if mr >= 1.5 else ("WARNING" if mr >= 1.0 else "OK")
            row = {col: float(src[col]) for col in texbat_cols + aissou_cols}
            row.update({
                "scenario": name,
                "tick": int(src["tick"]),
                "is_attack": int(src["is_attack"]),
                "prob_l1": float(p1[i]),
                "prob_l2": float(p2[i]),
                "ratio_l1": r1,
                "ratio_l2": r2,
                "verdict": verdict,
            })
            rows.append(row)

    fixture = pd.DataFrame(rows)
    out = TESTS_DIR / "parity_fixture.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    fixture.to_csv(out, index=False)
    print(f"[fixture] wrote {out} ({len(fixture)} rows)")


def write_schema(texbat_meta: dict, aissou_meta: dict) -> None:
    schema = {
        "texbat": {
            "n_features": texbat_meta["n_features"],
            "threshold": texbat_meta["threshold"],
            "feature_cols": texbat_meta["feature_cols"],
            "baseline_scenario": texbat_meta["baseline_scenario"],
            "baseline_t_int": texbat_meta["baseline_t_int"],
        },
        "aissou": {
            "n_features": aissou_meta["n_features"],
            "threshold": aissou_meta["threshold"],
            "threshold_source": aissou_meta["threshold_source"],
            "feature_cols": aissou_meta["feature_cols"],
        },
        "verdict_thresholds": {"warning": 1.0, "critical": 1.5},
    }
    out = ASSETS_DIR / "model_schema.json"
    out.write_text(json.dumps(schema, indent=2) + "\n")
    print(f"wrote {out}")


def run_subprocess(mode: str) -> dict:
    """Run a single mode in a fresh Python process and read its result file."""
    result_path = ASSETS_DIR / f".{mode}_meta.json"
    if result_path.exists():
        result_path.unlink()
    cmd = [sys.executable, str(Path(__file__).resolve()), "_run", mode]
    print(f"$ {' '.join(cmd)}")
    rc = subprocess.call(cmd)
    if rc != 0:
        raise SystemExit(f"[{mode}] export failed (rc={rc})")
    return json.loads(result_path.read_text())


def cmd_run(mode: str) -> None:
    """Internal: actually run an export inside the subprocess and dump meta."""
    if mode == "texbat":
        meta = export_texbat()
    elif mode == "aissou":
        meta = export_aissou()
    else:
        raise SystemExit(f"unknown mode: {mode}")
    out = ASSETS_DIR / f".{mode}_meta.json"
    out.write_text(json.dumps(meta) + "\n")


def cmd_all() -> None:
    texbat_meta = run_subprocess("texbat")
    aissou_meta = run_subprocess("aissou")
    write_schema(texbat_meta, aissou_meta)
    build_fixture()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["all", "texbat", "aissou", "fixture", "_run"])
    ap.add_argument("submode", nargs="?")
    args = ap.parse_args()

    if args.mode == "all":
        cmd_all()
    elif args.mode == "fixture":
        build_fixture()
    elif args.mode == "_run":
        if args.submode not in ("texbat", "aissou"):
            raise SystemExit("_run requires submode in (texbat, aissou)")
        cmd_run(args.submode)
    else:
        raise SystemExit("Use 'all' for the full pipeline; texbat/aissou are subprocess-only via _run.")


if __name__ == "__main__":
    main()
