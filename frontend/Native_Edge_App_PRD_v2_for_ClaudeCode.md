# Native On-Board Console PRD v2 — `gnss-defense-edge`
## Target: Claude Code execution

**Project:** GPS Spoofing Sentinel / GNSS Defense Monitor — On-Board Native Console
**Hackathon:** Honeywell Kościuszkon 2026
**Scope:** Standalone Rust application with native GUI, runs offline, local ONNX inference of TWO XGBoost models
**Goal:** Tier 1 deployment proof — "this could ship inside an aircraft tomorrow"
**Time budget:** 10–14 hours of focused execution
**Version:** v2.0 (rewritten from v1.0 against real codebase state)

---

## 0. What changed from v1.0 (READ FIRST)

After inspecting the actual repo, the following assumptions in v1.0 were **wrong** and have been corrected:

| v1.0 assumption | Reality | v2.0 fix |
|---|---|---|
| One ONNX model with two output heads | **Two separate `XGBClassifier`** for TEXBAT (L1) and AISSOU (L2), saved as `.joblib` | Two ONNX files, two `ort::Session`, two thresholds |
| Tick has ~10 raw fields | **CSV has 112 columns**: 8 metadata + 24 TEXBAT features + 80 AISSOU per-channel features | New `RawTick` schema with two pre-extracted feature blocks |
| Native app extracts features locally | Backend already pre-computes everything | **No feature extraction in Rust.** Read columns, slice into two `Vec<f32>`, pass to ONNX |
| Need to build UDP bridge from scratch | Backend exposes `/ws/replay/onboard` already emitting per-tick JSON with scores | Native app **ignores backend's pre-computed scores** and re-runs inference locally — that's the entire point of Tier 1. WebSocket is just a feed source. |
| ONNX is provided by Person C | Person C only delivers `.joblib` files | **Native app's build process exports `.joblib → .onnx`** itself in a build step or first-run step (handled by Claude Code) |
| Verdict thresholds are hardcoded somewhere | Backend's `alert_mapper.py:15-21` defines: `ratio ≥ 1.5 → CRITICAL`, `ratio ≥ 1.0 → WARNING` | Mirror exactly. Document inline. |
| Top reasons come from SHAP | Backend has its own logic | **Hardcoded rule-based reasons in Rust** based on dominant layer + simple feature thresholds. Future work: real SHAP. |
| Audio assets exist | They don't | **No audio in v2.0.** Visual-only alerts (flash, color, animations). |

These are not minor — they restructure half the modules. Read every section below as if v1.0 didn't exist.

---

## 1. Goals & Non-Goals (revised)

### Goals
1. **Standalone Rust binary** with native GUI, no network dependencies after launch
2. **Local inference of two XGBoost models** (TEXBAT L1 + AISSOU L2) via ONNX Runtime
3. **Self-contained ONNX export** — first-run script converts existing `.joblib` to `.onnx`, committed once and reused
4. **Two input modes:** CSV replay (deterministic, demo-realistic) and WebSocket client to backend's existing `/ws/replay/onboard` (demo bridge for synchronized side-by-side with web dashboard)
5. **Avionics-style native GUI** (egui) — score bars, verdict pill, alert log, position readout, mini-timeline
6. **Rule-based "top reasons"** — deterministic explanations from feature thresholds, not real SHAP
7. **Visual-only alerts** — full-screen flash, verdict pill animation, no audio
8. **QAR-style logging** — append-only JSONL of every tick + verdict
9. **Predictable performance:** < 5 ms total inference latency (both models combined), < 80 MB RAM, < 15 MB binary

### Non-Goals (explicit OUT)
- Real audio or beeps (no `rodio`, no WAV files)
- SHAP or any explainability beyond hardcoded rules
- Local feature extraction from raw GNSS samples (we trust backend's CSV)
- Real DO-178C / MISRA / no_std compliance — future work slide
- ARINC 429 / 653 / RTOS integration — future work slide
- Cross-compile to ARM (works on x86_64 macOS + Linux only)
- Modifying backend (we adapt to what's there, see §0)
- Real SHAP-based explanations (rule-based stub only)
- Tests beyond the parity test
- Multi-aircraft view (this is single-aircraft on-board)

### Definition of Done
- [ ] `cargo run --release` opens a native window without errors on Linux + macOS
- [ ] First-run script `scripts/export_onnx.py` converts both `.joblib` files to `.onnx` (Person C's joblib + a JSON config of feature names/order)
- [ ] CSV replay mode plays a 112-column scenario CSV at 1× speed, configurable 0.25× to 4×
- [ ] WebSocket mode connects to `ws://127.0.0.1:8000/ws/replay/onboard?scenario=...`, reads ticks, **runs its own inference locally**, ignores backend's score fields
- [ ] Two ONNX sessions produce verdicts that match backend's verdicts on identical inputs (parity test passes ≤ 1e-4)
- [ ] Verdict transitions visualized via UI flash (red overlay 500ms on first CRIT)
- [ ] QAR log file accumulates one JSON line per tick
- [ ] Inference latency reported in UI footer, sustained p95 < 5 ms total
- [ ] Binary size < 15 MB
- [ ] Demo banner visible whenever `--mode live` is active: "DEMO BRIDGE — production reads ARINC 429"
- [ ] No new console errors or panics during a 5-minute demo run

---

## 2. Tech Stack (revised — no audio, dual ONNX)

```toml
# Cargo.toml — pinned, Rust 1.83+

[package]
name = "gnss-defense-edge"
version = "0.1.0"
edition = "2021"
rust-version = "1.83"

[dependencies]
# GUI
eframe = "0.30"
egui = "0.30"
egui_plot = "0.30"

# ONNX inference (TWO sessions)
ort = { version = "2.0.0-rc.10", default-features = false, features = ["load-dynamic", "ndarray"] }
ndarray = "0.16"

# Data
serde = { version = "1", features = ["derive"] }
serde_json = "1"
csv = "1.3"

# WebSocket client (replaces UDP from v1.0)
tokio = { version = "1.42", features = ["rt", "rt-multi-thread", "sync", "time", "macros"] }
tokio-tungstenite = { version = "0.24", features = ["native-tls"] }
futures-util = "0.3"

# Logging & errors
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt"] }
anyhow = "1"
thiserror = "2"

# Concurrency
parking_lot = "0.12"
crossbeam-channel = "0.5"

# Time
chrono = { version = "0.4", features = ["serde"] }

# CLI
clap = { version = "4", features = ["derive"] }

# DELETED FROM v1.0:
# - rodio (no audio)
# - hound (no WAV)

[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
strip = true
```

### Key crate notes
- **`ort` 2.0.0-rc series** is current as of late 2025. API has been changing fast — `Session::builder()?.commit_from_file(path)?` is the canonical loader. If 2.0.0-rc.10 is bumped by hackathon time, lock to whatever is current; the patterns in §5 still apply.
- **`tokio-tungstenite`** for WebSocket client. Use `tokio` runtime, `connect_async()`, then read `Message::Text` lines and forward through `crossbeam_channel`.
- **No audio crate** — saved 1MB binary, eliminated entire class of cross-platform sound issues.

---

## 3. Architecture (revised)

```
┌──────────────────────────────────────────────────────────────────┐
│  egui main thread (60 fps render loop)                           │
│  ├─ Reads from Arc<RwLock<AppState>>                             │
│  ├─ Renders panels, animates flash on verdict transition         │
│  └─ Handles user input                                           │
└────────────────────┬─────────────────────────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
┌──────────────────┐    ┌──────────────────────────────┐
│  Tick producer   │    │  Inference worker            │
│  (csv OR ws)     │───▶│  (dedicated thread)          │
│                  │    │                              │
│  RawTick →       │    │  RawTick → split features →  │
│  channel         │    │  TEXBAT ONNX → prob_l1       │
└──────────────────┘    │  AISSOU ONNX → prob_l2       │
                        │  ratios → verdict → reasons  │
                        └────────┬─────────────────────┘
                                 │
                ┌────────────────┴────────────┐
                ▼                             ▼
        ┌──────────────┐             ┌──────────────┐
        │ Shared state │             │  QAR logger  │
        │ Arc<RwLock>  │             │  JSONL file  │
        └──────────────┘             └──────────────┘
```

**Inference pipeline (single tick):**
1. Take `RawTick` from channel
2. Slice 24 TEXBAT features → ndarray → TEXBAT session → prob_l1
3. Slice 80 AISSOU features → ndarray → AISSOU session → prob_l2
4. ratio_l1 = prob_l1 / threshold_l1; ratio_l2 = prob_l2 / threshold_l2
5. dominant_layer = argmax(ratio_l1, ratio_l2)
6. verdict = if max(ratio) >= 1.5 → CRIT; >= 1.0 → WARN; else → OK
7. reasons = lookup_rules(dominant_layer, features) → up to 3 strings
8. Append to QAR, push ScoredTick to shared state

Latency budget: each ONNX call ~1ms on tabular XGBoost, total p95 < 5ms.

---

## 4. ONNX Export Pipeline (NEW — was missing in v1.0)

Since Person C delivers `.joblib` files only, **Claude Code's first job is to create a Python script that exports them to ONNX.** This script runs once during setup; the resulting `.onnx` files are committed to the Rust repo's `assets/` folder.

### `scripts/export_onnx.py`

```python
#!/usr/bin/env python3
"""
Export TEXBAT and AISSOU XGBoost classifiers from joblib to ONNX.

Run once after Person C delivers the joblib files.
Output: assets/texbat_l1.onnx, assets/aissou_l2.onnx
"""

import argparse
import json
from pathlib import Path
import joblib
import numpy as np
from onnxmltools.convert import convert_xgboost
from onnxconverter_common.data_types import FloatTensorType


def export_one(joblib_path: Path, n_features: int, output_path: Path, name: str):
    print(f"Loading {name} from {joblib_path}")
    model = joblib.load(joblib_path)

    # Strip sklearn pipeline if wrapped — get the bare XGBClassifier
    if hasattr(model, "steps"):
        model = model.steps[-1][1]

    initial_type = [("input", FloatTensorType([None, n_features]))]
    onnx_model = convert_xgboost(model, initial_types=initial_type)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"  → wrote {output_path} ({output_path.stat().st_size // 1024} KB)")


def smoke_test(onnx_path: Path, joblib_path: Path, n_features: int):
    """Sanity: pick 10 random feature vectors, compare predict_proba."""
    import onnxruntime as ort

    sk_model = joblib.load(joblib_path)
    if hasattr(sk_model, "steps"):
        sk_model = sk_model.steps[-1][1]

    rng = np.random.default_rng(42)
    X = rng.standard_normal((10, n_features)).astype(np.float32)

    sk_proba = sk_model.predict_proba(X)[:, 1]

    sess = ort.InferenceSession(str(onnx_path))
    onnx_out = sess.run(None, {"input": X})
    # ONNX output schema for binary XGBClassifier: [labels, probabilities (list of dicts)]
    onnx_proba = np.array([row[1] for row in onnx_out[1]])

    diff = np.abs(sk_proba - onnx_proba)
    print(f"Parity check {onnx_path.name}: max diff = {diff.max():.2e}")
    assert diff.max() < 1e-5, "Parity broken — investigate before shipping"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--texbat-joblib", type=Path, required=True)
    ap.add_argument("--aissou-joblib", type=Path, required=True)
    ap.add_argument("--out-dir", type=Path, default=Path("assets"))
    ap.add_argument("--n-features-texbat", type=int, default=24)
    ap.add_argument("--n-features-aissou", type=int, default=80)
    args = ap.parse_args()

    export_one(args.texbat_joblib, args.n_features_texbat,
               args.out_dir / "texbat_l1.onnx", "TEXBAT/L1")
    export_one(args.aissou_joblib, args.n_features_aissou,
               args.out_dir / "aissou_l2.onnx", "AISSOU/L2")

    smoke_test(args.out_dir / "texbat_l1.onnx", args.texbat_joblib, args.n_features_texbat)
    smoke_test(args.out_dir / "aissou_l2.onnx", args.aissou_joblib, args.n_features_aissou)

    # Write feature schema for Rust to consume
    schema = {
        "texbat": {
            "n_features": args.n_features_texbat,
            "threshold": 0.5,  # TODO: read from backend's alert_mapper.py
        },
        "aissou": {
            "n_features": args.n_features_aissou,
            "threshold": 0.5,
        },
    }
    schema_path = args.out_dir / "model_schema.json"
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
    print(f"Wrote {schema_path}")


if __name__ == "__main__":
    main()
```

### Setup commands

```bash
cd gnss-defense-edge
python -m venv .venv && source .venv/bin/activate
pip install joblib xgboost onnxmltools onnxconverter-common onnxruntime numpy scikit-learn

python scripts/export_onnx.py \
    --texbat-joblib ../backend/models/texbat_l1.joblib \
    --aissou-joblib ../backend/models/aissou_l2.joblib

# Verify
ls -lh assets/*.onnx assets/model_schema.json
```

After this runs once, commit `assets/texbat_l1.onnx`, `assets/aissou_l2.onnx`, `assets/model_schema.json`. Rust never invokes Python.

### Failure modes Claude Code should handle gracefully
- **`onnxmltools` doesn't support some XGBoost version** → try `skl2onnx` as fallback for sklearn pipeline-wrapped models
- **Parity check fails** → log feature names from joblib (`model.feature_names_in_`), confirm expected order, re-export with explicit feature list
- **Person C's joblib is a sklearn `Pipeline`** with preprocessing → export the full pipeline OR strip and document that backend must apply same preprocessing before sending features. CSV has features pre-computed, so this is fine in our case.

---

## 5. Module Layout (revised)

```
gnss-defense-edge/
├── Cargo.toml
├── README.md
├── scripts/
│   └── export_onnx.py            # NEW — Python ONNX export
├── assets/
│   ├── texbat_l1.onnx            # generated by export_onnx.py
│   ├── aissou_l2.onnx            # generated by export_onnx.py
│   └── model_schema.json         # feature counts + thresholds
├── scenarios/                    # symlink or copy from backend
│   ├── normal_waw_gdn.csv
│   ├── texbat_spoof.csv
│   └── aissou_channel_attack.csv
├── tests/
│   ├── parity_fixture.csv        # 100 rows: features + expected verdict
│   └── inference_parity.rs       # asserts Rust matches Python ≤ 1e-4
├── src/
│   ├── main.rs
│   ├── app.rs                    # eframe::App impl
│   ├── state.rs                  # AppState
│   ├── ticks.rs                  # RawTick (112 cols), ScoredTick, Verdict, Layer
│   ├── inference/
│   │   ├── mod.rs                # InferenceWorker
│   │   ├── dual_runner.rs        # owns TWO ort sessions
│   │   ├── reasons.rs            # rule-based top_reasons
│   │   └── feature_slice.rs      # extracts 24 + 80 features from RawTick
│   ├── feed/
│   │   ├── mod.rs                # FeedSource trait
│   │   ├── csv_replay.rs
│   │   └── ws_client.rs          # NEW — replaces udp_listener.rs
│   ├── ui/
│   │   ├── mod.rs
│   │   ├── theme.rs
│   │   ├── header.rs
│   │   ├── score_panel.rs
│   │   ├── verdict_panel.rs
│   │   ├── alert_log.rs
│   │   ├── timeline.rs
│   │   ├── flash_overlay.rs      # NEW — visual CRIT alert (no audio)
│   │   └── footer.rs             # includes DEMO BRIDGE banner
│   ├── qar.rs
│   └── cli.rs
```

Module count vs v1.0:
- **NEW:** `dual_runner.rs`, `reasons.rs`, `feature_slice.rs`, `ws_client.rs`, `flash_overlay.rs`, `scripts/export_onnx.py`
- **DELETED:** `audio.rs`, `udp_listener.rs`
- **CHANGED:** `ticks.rs` (way more fields), `cli.rs` (different feed modes), `inference/mod.rs` (two sessions)

---

## 6. Detailed Module Specs (revised sections)

### 6.1 `src/ticks.rs` — TWO sets of features

```rust
use serde::{Deserialize, Serialize};

/// Mirror of backend's tick CSV row. Field names MUST match CSV headers.
/// Backend emits: 8 metadata + 24 TEXBAT + 80 AISSOU = 112 columns.
///
/// Convention: backend pre-computes everything. Native app does NOT
/// re-extract features from raw GNSS observations — that's not v0.1 scope.
#[derive(Debug, Clone, Deserialize)]
pub struct RawTick {
    // --- 8 metadata fields ---
    pub tick: u64,
    pub timestamp: f64,
    pub callsign: String,
    pub lat: f64,
    pub lon: f64,
    pub alt_ft: f32,
    pub heading_deg: f32,
    pub gs_kt: f32,

    // --- 24 TEXBAT features (L1) ---
    // Names MUST match CSV. Coordinate with Person C on exact list.
    // Use serde flatten + helper struct OR enumerate explicitly.
    // Pragma: explicit fields are more verbose but easier to debug.
    #[serde(flatten)]
    pub texbat: TexbatFeatures,

    // --- 80 AISSOU features (L2) — 8 channels × 10 features each ---
    #[serde(flatten)]
    pub aissou: AissouFeatures,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TexbatFeatures {
    // TODO: actual field list provided by Person C.
    // Pattern (placeholder until exact names known):
    pub texbat_cn0_mean: f32,
    pub texbat_cn0_std: f32,
    pub texbat_cn0_min: f32,
    pub texbat_cn0_max: f32,
    pub texbat_doppler_mean: f32,
    pub texbat_doppler_std: f32,
    pub texbat_pseudorange_residual: f32,
    pub texbat_clock_bias: f32,
    pub texbat_n_sats: f32,
    pub texbat_hdop: f32,
    pub texbat_pdop: f32,
    // ... 13 more
}

#[derive(Debug, Clone, Deserialize)]
pub struct AissouFeatures {
    // 8 channels × 10 features. Naming: aissou_ch{N}_{feature}
    // TODO: confirm exact list with Person C.
    pub aissou_ch1_cn0: f32,
    pub aissou_ch1_doppler: f32,
    // ... continued
    // For brevity, consider:
    // #[serde(flatten)]
    // pub raw: HashMap<String, f32>,
    // ... but that loses static typing.
}

/// What inference produces.
#[derive(Debug, Clone, Serialize)]
pub struct ScoredTick {
    pub tick: u64,
    pub timestamp: f64,
    pub callsign: String,
    pub lat: f64,
    pub lon: f64,
    pub alt_ft: f32,
    pub heading_deg: f32,

    pub prob_l1: f32,
    pub prob_l2: f32,
    pub ratio_l1: f32,    // prob_l1 / threshold_l1
    pub ratio_l2: f32,
    pub verdict: Verdict,
    pub dominant_layer: Layer,
    pub top_reasons: Vec<String>,

    pub inference_us: u64,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize)]
pub enum Verdict { Ok, Warn, Critical }

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize)]
pub enum Layer { L1, L2, None }
```

**Implementation note for Claude Code:** the exact list of 24 TEXBAT and 80 AISSOU column names must come from Person C or be inspected from one of the scenario CSVs at startup. Pattern:

```rust
// On first run, sniff CSV headers and validate they match expected 112 columns.
// Print missing/extra columns and exit cleanly if mismatch — better than silent slicing bugs.
```

If field names are too cumbersome to enumerate, use `serde(flatten) + HashMap<String, f32>` and define `TEXBAT_FEATURE_ORDER: [&str; 24]` and `AISSOU_FEATURE_ORDER: [&str; 80]` constants — `feature_slice.rs` looks up by name. **This is the safer path.**

### 6.2 `src/inference/feature_slice.rs` — split RawTick into two vectors

```rust
use crate::ticks::RawTick;
use std::collections::HashMap;

/// Frozen feature order, matches the order used during training.
/// Source: backend repo (Person C must confirm).
pub const TEXBAT_FEATURE_ORDER: [&str; 24] = [
    "texbat_cn0_mean", "texbat_cn0_std", "texbat_cn0_min", "texbat_cn0_max",
    // ... full list confirmed with Person C
];

pub const AISSOU_FEATURE_ORDER: [&str; 80] = [
    "aissou_ch1_cn0", "aissou_ch1_doppler",
    // ... full list confirmed with Person C
];

/// If RawTick uses HashMap<String, f32> for features, slice by name.
pub fn slice_texbat(features: &HashMap<String, f32>) -> anyhow::Result<Vec<f32>> {
    TEXBAT_FEATURE_ORDER.iter()
        .map(|&name| features.get(name).copied()
            .ok_or_else(|| anyhow::anyhow!("missing TEXBAT feature: {name}")))
        .collect()
}

pub fn slice_aissou(features: &HashMap<String, f32>) -> anyhow::Result<Vec<f32>> {
    AISSOU_FEATURE_ORDER.iter()
        .map(|&name| features.get(name).copied()
            .ok_or_else(|| anyhow::anyhow!("missing AISSOU feature: {name}")))
        .collect()
}
```

### 6.3 `src/inference/dual_runner.rs` — TWO ONNX sessions

```rust
use ort::{session::Session, value::Value};
use ndarray::Array2;
use std::path::Path;
use std::time::Instant;
use anyhow::Result;
use serde::Deserialize;

#[derive(Deserialize)]
struct ModelSchemaEntry { n_features: usize, threshold: f32 }
#[derive(Deserialize)]
struct ModelSchema { texbat: ModelSchemaEntry, aissou: ModelSchemaEntry }

pub struct DualRunner {
    texbat: Session,
    aissou: Session,
    threshold_l1: f32,
    threshold_l2: f32,
    n_features_l1: usize,
    n_features_l2: usize,
}

impl DualRunner {
    pub fn load(assets_dir: &Path) -> Result<Self> {
        let schema_str = std::fs::read_to_string(assets_dir.join("model_schema.json"))?;
        let schema: ModelSchema = serde_json::from_str(&schema_str)?;

        let texbat = Session::builder()?
            .commit_from_file(assets_dir.join("texbat_l1.onnx"))?;
        let aissou = Session::builder()?
            .commit_from_file(assets_dir.join("aissou_l2.onnx"))?;

        Ok(Self {
            texbat, aissou,
            threshold_l1: schema.texbat.threshold,
            threshold_l2: schema.aissou.threshold,
            n_features_l1: schema.texbat.n_features,
            n_features_l2: schema.aissou.n_features,
        })
    }

    /// Returns (prob_l1, prob_l2, total_microseconds).
    pub fn run(&mut self, l1: &[f32], l2: &[f32]) -> Result<(f32, f32, u64)> {
        anyhow::ensure!(l1.len() == self.n_features_l1, "L1 feature count mismatch");
        anyhow::ensure!(l2.len() == self.n_features_l2, "L2 feature count mismatch");

        let start = Instant::now();

        let in_l1 = Array2::from_shape_vec((1, self.n_features_l1), l1.to_vec())?;
        let in_l2 = Array2::from_shape_vec((1, self.n_features_l2), l2.to_vec())?;

        let out_l1 = self.texbat.run(ort::inputs![ "input" => in_l1.view() ]?)?;
        let out_l2 = self.aissou.run(ort::inputs![ "input" => in_l2.view() ]?)?;

        // ONNX export of XGBClassifier produces [label_tensor, probability_tensor_or_seq_of_maps]
        // Probability is at index 1. Class 1 (spoofed) probability:
        let p_l1 = extract_class1_prob(&out_l1)?;
        let p_l2 = extract_class1_prob(&out_l2)?;

        let elapsed = start.elapsed().as_micros() as u64;
        Ok((p_l1, p_l2, elapsed))
    }

    pub fn thresholds(&self) -> (f32, f32) {
        (self.threshold_l1, self.threshold_l2)
    }
}

fn extract_class1_prob(outputs: &ort::session::SessionOutputs) -> Result<f32> {
    // Depending on onnxmltools version, this is either:
    // (a) tensor [batch, 2] — take [0, 1]
    // (b) sequence<map<int64, float>> — take outputs[0][1]
    // Try (a) first.
    let out = &outputs[1];
    if let Ok(tensor) = out.try_extract_tensor::<f32>() {
        return Ok(tensor[[0, 1]]);
    }
    // Fallback (b) requires custom extraction; document and revisit if (a) fails.
    anyhow::bail!("Unsupported ONNX probability output shape — re-run export_onnx.py with --use-tensor-output")
}
```

**Critical note for Claude Code:** the exact ONNX output schema depends on `onnxmltools` version. Test with `extract_class1_prob` and if it fails, instrument to print the output shape, then adapt. **Do NOT silently fall back to wrong values.**

### 6.4 `src/inference/reasons.rs` — rule-based top reasons

No SHAP. Hardcoded thresholds that produce a list of human-readable strings based on which layer dominates and which features look anomalous.

```rust
use crate::ticks::{Layer, RawTick};

pub fn top_reasons(layer: Layer, tick: &RawTick) -> Vec<String> {
    let mut out = Vec::new();
    match layer {
        Layer::L1 => {
            // Rule: high C/N0 std means uneven channel signal — typical spoofer signature
            if tick.texbat.texbat_cn0_std > 5.0 {
                out.push(format!(
                    "C/N0 standard deviation high ({:.1} dB-Hz) — uneven channel response",
                    tick.texbat.texbat_cn0_std
                ));
            }
            if tick.texbat.texbat_doppler_std > 100.0 {
                out.push(format!(
                    "Doppler dispersion {:.0} Hz — inconsistent with satellite geometry",
                    tick.texbat.texbat_doppler_std
                ));
            }
            if tick.texbat.texbat_n_sats < 6.0 {
                out.push(format!(
                    "Only {} satellites tracked — possible signal capture",
                    tick.texbat.texbat_n_sats as i32
                ));
            }
            if tick.texbat.texbat_hdop > 3.0 {
                out.push(format!(
                    "HDOP {:.1} — geometry degraded",
                    tick.texbat.texbat_hdop
                ));
            }
        }
        Layer::L2 => {
            // Aissou: per-channel anomalies. Count channels with anomalous C/N0
            // (we'd inspect the 80-feature vector — illustrative example follows)
            out.push("Multi-channel C/N0 anomaly across L2 PRN set".to_string());
            out.push("Per-channel Doppler residuals exceeded training distribution".to_string());
        }
        Layer::None => {
            out.push("Signal nominal".to_string());
        }
    }
    out.truncate(3);
    out
}
```

The exact thresholds (5.0, 100.0, etc.) are illustrative. Claude Code should ask Person C for ballpark "typical normal" vs "typical attack" values for 3-4 key features and tune. Five rules total is enough — judges won't dissect them.

### 6.5 `src/inference/mod.rs` — the worker

```rust
use std::sync::Arc;
use parking_lot::RwLock;
use crossbeam_channel::Receiver;
use std::path::Path;

use crate::ticks::{RawTick, ScoredTick, Verdict, Layer};
use crate::state::AppState;
use crate::qar::QarLogger;
use super::dual_runner::DualRunner;
use super::reasons::top_reasons;
use super::feature_slice::{slice_texbat, slice_aissou};

pub fn run_worker(
    assets_dir: &Path,
    rx: Receiver<RawTick>,
    state: Arc<RwLock<AppState>>,
    qar: Arc<QarLogger>,
) -> anyhow::Result<()> {
    let mut runner = DualRunner::load(assets_dir)?;
    tracing::info!("ONNX models loaded; thresholds = {:?}", runner.thresholds());

    while let Ok(tick) = rx.recv() {
        // Convert RawTick → two feature slices.
        // If using HashMap-based features, use feature_slice helpers.
        // If using struct-based, manually assemble.
        let l1 = todo!("slice TEXBAT vector from tick");
        let l2 = todo!("slice AISSOU vector from tick");

        let (p_l1, p_l2, elapsed_us) = runner.run(&l1, &l2)?;
        let (t_l1, t_l2) = runner.thresholds();

        let r_l1 = p_l1 / t_l1;
        let r_l2 = p_l2 / t_l2;

        let dominant = if r_l1 >= r_l2 { Layer::L1 } else { Layer::L2 };
        let max_r = r_l1.max(r_l2);
        let verdict = if max_r >= 1.5 { Verdict::Critical }
                      else if max_r >= 1.0 { Verdict::Warn }
                      else { Verdict::Ok };

        let reasons = if verdict == Verdict::Ok {
            vec![]
        } else {
            top_reasons(dominant, &tick)
        };

        let scored = ScoredTick {
            tick: tick.tick, timestamp: tick.timestamp, callsign: tick.callsign.clone(),
            lat: tick.lat, lon: tick.lon, alt_ft: tick.alt_ft, heading_deg: tick.heading_deg,
            prob_l1: p_l1, prob_l2: p_l2, ratio_l1: r_l1, ratio_l2: r_l2,
            verdict, dominant_layer: dominant, top_reasons: reasons,
            inference_us: elapsed_us,
        };

        qar.log(&scored)?;
        state.write().push(scored);
    }
    Ok(())
}
```

### 6.6 `src/feed/ws_client.rs` — replaces UDP listener

Backend already exposes `/ws/replay/onboard?scenario=...`. We connect, read JSON-per-message, parse to `RawTick`, ignore the score fields the backend pre-computed (we re-derive locally — the entire point of Tier 1).

```rust
use crossbeam_channel::Sender;
use tokio_tungstenite::connect_async;
use futures_util::StreamExt;
use crate::ticks::RawTick;

pub async fn run_ws(
    url: &str,
    tx: Sender<RawTick>,
) -> anyhow::Result<()> {
    let (mut stream, _resp) = connect_async(url).await?;
    tracing::info!("WebSocket connected: {}", url);

    while let Some(msg) = stream.next().await {
        let msg = msg?;
        if msg.is_text() {
            let text = msg.to_text()?;
            // Backend's payload includes score fields; we DO NOT use them.
            // Parse with serde — let unused fields be ignored via #[serde(deny_unknown_fields)] = false (default).
            match serde_json::from_str::<RawTick>(text) {
                Ok(tick) => { let _ = tx.send(tick); }
                Err(e) => tracing::warn!("WS parse error: {e}"),
            }
        }
    }
    Ok(())
}
```

**Important nuance:** backend's WS payload ALREADY contains `scores.L1`, `scores.L2`, `verdict`, `top_reasons` (per your codebase analysis). Native app **must ignore those fields** and re-compute via local ONNX. To make this airtight:

```rust
// In ticks.rs, RawTick deserializes the FEATURE columns + metadata only.
// The score fields are simply not declared in RawTick — serde silently ignores them.
// Add a debug log on first tick: "ignoring backend's pre-computed score; running local inference."
```

This is the demo argument: "look, native app doesn't trust backend's verdict — it runs the model itself, that's why deployable on aircraft."

### 6.7 `src/cli.rs` — replaces UDP mode with WebSocket

```rust
use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(version, about = "GNSS Defense Edge — On-Board Spoofing Detector")]
pub struct Cli {
    #[arg(long, default_value = "assets")]
    pub assets_dir: PathBuf,

    #[arg(long, default_value = "gnss-defense-qar.log")]
    pub qar: PathBuf,

    #[command(subcommand)]
    pub mode: FeedMode,
}

#[derive(Subcommand)]
pub enum FeedMode {
    /// Play back a scenario CSV (deterministic, demo-realistic)
    Replay {
        #[arg(long)] scenario: PathBuf,
        #[arg(long, default_value_t = 1.0)] speed: f32,
        #[arg(long)] looped: bool,
    },
    /// Connect to backend's existing /ws/replay/onboard for synchronized side-by-side demo
    Live {
        #[arg(long, default_value = "ws://127.0.0.1:8000/ws/replay/onboard")]
        url: String,
        #[arg(long)] scenario: String,
    },
}
```

Demo invocations:

```bash
# Cold offline replay (most production-realistic)
./gnss-defense-edge replay --scenario scenarios/texbat_spoof.csv

# Side-by-side with web dashboard, both reading same backend stream
./gnss-defense-edge live --scenario texbat_spoof
```

### 6.8 `src/ui/flash_overlay.rs` — visual CRIT alert (replacing audio)

```rust
use egui::{Context, Color32, LayerId, Order, Id, Stroke, Rect, Pos2, Vec2};
use std::time::Instant;

pub struct FlashState {
    last_trigger: Option<Instant>,
}

impl FlashState {
    pub fn new() -> Self { Self { last_trigger: None } }

    pub fn trigger(&mut self) {
        self.last_trigger = Some(Instant::now());
    }

    pub fn paint(&self, ctx: &Context) {
        let Some(t) = self.last_trigger else { return; };
        let elapsed = t.elapsed().as_millis() as f32;
        const DURATION_MS: f32 = 500.0;
        if elapsed > DURATION_MS { return; }

        let alpha = (1.0 - elapsed / DURATION_MS).powi(2);
        let color = Color32::from_rgba_unmultiplied(0xEF, 0x44, 0x44, (alpha * 200.0) as u8);

        let screen = ctx.screen_rect();
        let painter = ctx.layer_painter(LayerId::new(Order::Foreground, Id::new("flash")));
        painter.rect_filled(screen, 0.0, color);

        // Border accent for extra drama
        painter.rect_stroke(screen.shrink(4.0), 0.0,
            Stroke::new(4.0 * alpha, Color32::from_rgb(0xEF, 0x44, 0x44)));

        ctx.request_repaint();
    }
}
```

Triggered in `app.rs` on first CRIT transition (same logic as v1.0 but visual instead of audio).

### 6.9 `src/ui/footer.rs` — DEMO BRIDGE banner (unchanged from v1 update, included for completeness)

Footer must show "⚠ DEMO BRIDGE — production reads ARINC 429" whenever `--mode live`. This is non-negotiable — see §0 production-vs-demo discussion in v1 PRD which still applies.

### 6.10 `src/main.rs` — wire it all up

```rust
use clap::Parser;
use std::sync::Arc;
use parking_lot::RwLock;

mod cli; mod state; mod ticks;
mod inference; mod feed; mod ui; mod qar; mod app;

fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let args = cli::Cli::parse();

    let state = Arc::new(RwLock::new(state::AppState::default()));
    let qar = Arc::new(qar::QarLogger::open(&args.qar)?);

    let (raw_tx, raw_rx) = crossbeam_channel::bounded::<ticks::RawTick>(256);

    // Inference worker
    {
        let assets = args.assets_dir.clone();
        let state = state.clone();
        let qar = qar.clone();
        std::thread::spawn(move || {
            if let Err(e) = inference::run_worker(&assets, raw_rx, state, qar) {
                tracing::error!("inference worker died: {e:?}");
            }
        });
    }

    // Feed
    match args.mode.clone() {
        cli::FeedMode::Replay { scenario, speed, looped } => {
            std::thread::spawn(move || {
                let _ = feed::csv_replay::run_csv(&scenario, speed, looped, raw_tx);
            });
        }
        cli::FeedMode::Live { url, scenario } => {
            let full_url = format!("{}?scenario={}", url, scenario);
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    let _ = feed::ws_client::run_ws(&full_url, raw_tx).await;
                });
            });
        }
    }

    // GUI
    let opts = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 800.0])
            .with_title("GNSS Defense Edge — Kościuszkon 2026"),
        ..Default::default()
    };
    eframe::run_native(
        "gnss-defense-edge",
        opts,
        Box::new(|cc| Ok(Box::new(app::GnssDefenseApp::new(cc, state, args.mode)))),
    ).map_err(|e| anyhow::anyhow!("eframe failed: {e}"))?;
    Ok(())
}
```

---

## 7. Implementation Order (revised — 10–14h)

### Phase 0 — ONNX export (1.5h, **prerequisites**)

This is **before** any Rust code. Without ONNX files there's nothing to inference against.

1. Create `scripts/export_onnx.py` per §4
2. Get joblib files from Person C — coordinate ASAP
3. Run export, verify parity test passes (max diff < 1e-5)
4. Commit `assets/texbat_l1.onnx`, `assets/aissou_l2.onnx`, `assets/model_schema.json`
5. Document in README which joblibs were used (path + git hash)

**Checkpoint:** Two ONNX files exist; smoke test confirms they match joblib predictions on random vectors.

### Phase 1 — Boot + theme + window (1h)

1. `cargo new gnss-defense-edge --bin`
2. Fill `Cargo.toml` per §2
3. `src/main.rs` opens empty egui window with title bar
4. `src/cli.rs`, parse args, log them
5. `src/state.rs` with `AppState::default()`
6. `src/ui/theme.rs`, install dark avionics theme

**Checkpoint:** `cargo run --release -- replay --scenario foo.csv` opens dark window.

### Phase 2 — CSV feed + dummy scoring (2h)

1. `src/ticks.rs` — write full schema, decide HashMap vs explicit struct (recommend HashMap with constant order arrays)
2. Inspect actual scenario CSV header, write feature order constants based on actual file
3. `src/feed/csv_replay.rs` reads CSV, sends to channel
4. **Dummy scoring**: rotate score sinusoidally without ONNX — just to verify UI updates
5. Verdict panel + timeline shows fake but plausible cycle

**Checkpoint:** Window shows oscillating verdicts; UI plumbing works end-to-end.

### Phase 3 — Score panel + alert log + flash (2h)

1. `src/ui/score_panel.rs` — two bars + sparkline
2. `src/ui/alert_log.rs` — scrolling list
3. `src/ui/header.rs` + `src/ui/footer.rs` — including DEMO BRIDGE banner logic
4. `src/ui/flash_overlay.rs` — full-screen red flash
5. Trigger flash on first CRIT transition

**Checkpoint:** Looks like avionics; CRIT triggers flash.

### Phase 4 — Real ONNX inference (2.5h)

1. `src/inference/dual_runner.rs` loads two `.onnx` files
2. `src/inference/feature_slice.rs` extracts ordered vectors
3. `src/inference/reasons.rs` rule-based explanations
4. `src/inference/mod.rs` worker glues everything
5. Replace dummy scorer with real `DualRunner::run()`
6. **CRITICAL:** verify output shape — debug-print first few outputs, fix `extract_class1_prob` if needed

**Checkpoint:** Real verdicts on real CSV scenarios. Manual spot-check: "spoof scenario produces CRIT, normal scenario stays OK."

### Phase 5 — Parity test (1.5h)

1. Person C provides `parity_fixture.csv` — 100 rows of features + Python-computed `prob_l1`, `prob_l2`, `verdict`
2. `tests/inference_parity.rs` reads fixture, runs Rust inference, asserts max diff ≤ 1e-4
3. Run `cargo test --release inference_parity` — must pass
4. If fails: investigate feature order, threshold mismatch, ONNX schema

**Checkpoint:** Numerical parity Python ↔ Rust confirmed.

### Phase 6 — WebSocket live mode (1.5h)

1. `src/feed/ws_client.rs` connects to backend's `/ws/replay/onboard?scenario=…`
2. Parses JSON ticks, ignoring backend's pre-computed score fields
3. Tests: open backend, run `cargo run --release -- live --scenario texbat_spoof`
4. Verify side-by-side with web dashboard — same scenario, both react synchronously
5. DEMO BRIDGE banner confirmed visible

**Checkpoint:** Live mode demo works.

### Phase 7 — QAR + polish + README (1h)

1. `src/qar.rs` JSONL writer
2. README with build instructions, demo invocations, screenshots
3. Verify binary size, latency, RAM
4. `cargo clippy --release -- -D warnings` clean

**Phase 8 — Buffer (0.5–1h)** — for whatever broke.

---

## 8. Inter-Team Contracts (revised)

### From Person C
1. **`texbat_l1.joblib` + `aissou_l2.joblib`** — the actual trained models
2. **Feature names list** — exact column order for each model's input vector. Either a Python list dumped to JSON or by inspection of `model.feature_names_in_`
3. **Thresholds** — confirm whether 0.5/0.5 is correct or backend uses different values; coordinate with `alert_mapper.py:15-21`
4. **`parity_fixture.csv`** — 100 rows of (features columns + expected `prob_l1`, `prob_l2`, `verdict`). Generated by running joblib model on a sample.
5. **Top features per layer** — informally, "which 3-4 features tend to dominate when L1 attack happens vs L2 attack" — used to tune `reasons.rs` thresholds

### From Person B
- Confirm WebSocket endpoint URL, scenario query params, payload shape
- Don't change anything — we adapt

### From Person A
- One screenshot of native app embedded in pitch deck

### From Person D
- Pitch slide template for "Tier 1 — On-Board Console"
- Talking points (provided in §10)

---

## 9. Acceptance Tests (revised)

1. **Cold build:** `git clone && cargo build --release` succeeds in < 5 min on clean machine
2. **ONNX export:** `python scripts/export_onnx.py --texbat-joblib X --aissou-joblib Y` runs cleanly, parity smoke test prints "max diff = X.XXe-XX" with X<5
3. **Boring scenario:** `cargo run --release -- replay --scenario normal_waw_gdn.csv` runs to completion, verdict stays OK throughout, no flash, QAR has expected line count
4. **Spoof scenario:** `replay --scenario texbat_spoof.csv` shows OK→WARN→CRIT, one flash, alert log populates
5. **Speed control:** Same scenario at `--speed 0.25` and `--speed 4.0` — UI keeps up
6. **Live mode:** `live --scenario texbat_spoof` while web dashboard runs same scenario — both react in lockstep
7. **DEMO BRIDGE banner** visible whenever `--mode live` active
8. **Parity:** `cargo test inference_parity` passes
9. **Latency:** Footer shows p50 inference < 2ms, p95 < 5ms (TWO models combined)
10. **Memory:** `ps -o rss` < 80 MB after 5-min run
11. **Binary size:** < 15 MB
12. **No score-trust regression:** Even if backend sends `scores.L1=0.99` in WS payload, native app's UI shows native-computed L1, NOT backend's. Verify by manually patching backend payload in dev.

---

## 10. Pitch Integration (revised)

The talking points change slightly because of dual-model architecture:

> "On the left screen — the same models, in a Rust binary, running locally. Two XGBoost classifiers, exported to ONNX, fully self-contained. Five-millisecond combined inference latency. Forty megabytes of RAM. Zero network calls — even though we're connected to the backend right now via demo bridge, the native app **does its own inference** and ignores backend's verdicts. That's why this could ship inside an aircraft tomorrow."

Slide content:
- Screenshot of native app during CRIT alert
- Stats: combined inference p50/p95, binary size, RAM
- Diagram showing two ONNX sessions feeding one verdict
- One-line: "Rust + ONNX Runtime. Two models. Cross-platform x86_64. Zero network."
- Future work bullet: SHAP, ARM cross-compile, ARINC 429 reader, no_std

---

## 11. Risks & Mitigations (revised)

| Risk | Likelihood | Mitigation |
|---|---|---|
| `onnxmltools` chokes on Person C's XGBoost version | High | Try `skl2onnx` fallback; if both fail, use `gbdt-rs` to load joblib's underlying booster JSON dump |
| ONNX output shape varies (tensor vs sequence-of-maps) | High | `extract_class1_prob` tries tensor first, has clear error path; debug-print outputs[1] shape on first run |
| Person C's joblib is `Pipeline`-wrapped with preprocessing | Med | CSV has features already preprocessed → strip pipeline, export only the XGBClassifier step |
| Feature column order in CSV ≠ training order | High | Validate at startup: read header, compare to constants, exit cleanly with diff report if mismatch |
| 24+80=104 features but `model_schema.json` says 24+80 ≠ actual ONNX input shape | Med | `Session.inputs[0].dimensions()` tells us the real shape; assert at load time |
| WebSocket payload schema differs from CSV | Med | Decode WS message into HashMap-typed struct, slice with same `feature_slice` helpers |
| Backend's WS includes pre-computed scores we MUST ignore | Med | RawTick simply doesn't declare those fields; serde ignores them silently; add debug log on first tick |
| `eframe` rendering issues on demo laptop GPU | Low | egui has wgpu backend fallback |
| Binary size > 15 MB target | Low | `strip = true` already in profile.release; if needed, `cargo bloat --release` to find offenders |
| Latency > 5ms for combined inference | Low | XGBoost ONNX inference is ~1ms; if it's slow, model file is wrong or batch dim mismatched |
| `ort` 2.0.0-rc API changes between now and hackathon | Med | Pin in Cargo.toml; if upstream forces upgrade, the patterns here still apply, only method names change |

---

## 12. Notes for Claude Code (revised)

1. **Phase 0 (ONNX export) is BLOCKING.** Don't write Rust code until you have working `.onnx` files. If Person C can't deliver joblib, escalate immediately — you're stuck.
2. **Read the actual scenario CSV header before writing `RawTick`.** Don't guess column names. Use `head -1 backend/scenarios/texbat_spoof.csv` to see real names.
3. **Verify ONNX I/O shapes immediately after loading.** `tracing::info!("session inputs: {:?}", session.inputs)` prints them. Match against `model_schema.json`.
4. **Test parity in Phase 5 — don't skip.** A native app that produces wrong verdicts is worse than no native app.
5. **Don't trust backend's pre-computed scores in WS payload.** Re-derive locally. This is the whole point.
6. **Document feature order constants in plain Rust comments referencing the source.** When Person C asks "where did you get these names?", answer must be precise.
7. **No audio.** Flash overlay is the only CRIT alert.
8. **`#[serde(default)]` liberally.** Backend may add fields over time; native shouldn't break on new ones.
9. **`cargo clippy` clean. Zero warnings shipped.**
10. **Commit after each Phase.**

---

## 13. Out of Scope — explicitly NO

- Audio (no rodio, no WAV, no beeps)
- SHAP or any ML explainability beyond `reasons.rs` rules
- Local feature extraction from raw GNSS samples
- Backend modifications
- DO-178C / MISRA / no_std / formal verification
- ARINC 429 / 653 / RTOS integration
- Cross-compile to ARM
- Multi-aircraft view (single platform only)
- Mobile, WebAssembly, embedded targets
- Auto-retraining, online learning
- Database persistence beyond JSONL log
- User auth, multi-user, network beyond WS to local backend

---

*Document v2.0 — for Claude Code execution. Tier 1 native console. Companion to FE Upgrade PRD.*
*Major rewrite from v1.0 against actual codebase state: dual model, 112-col CSV, WebSocket feed, no audio.*
