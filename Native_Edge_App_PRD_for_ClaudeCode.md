# Native On-Board Console PRD — `gnss-defense-edge`
## Target: Claude Code execution

**Project:** GPS Spoofing Sentinel / GNSS Defense Monitor — On-Board Native Console
**Hackathon:** Honeywell Kościuszkon 2026
**Scope:** Standalone Rust application with native GUI, runs offline, local ONNX inference
**Goal:** Tier 1 deployment proof — "this could ship inside an aircraft tomorrow"
**Time budget:** 10–14 hours of focused execution

---

## 0. Context for Claude Code

This is the **third tier** of the GNSS Defense Monitor project. We already have:
- **Tier 3 (Network/Fleet):** React + Mapbox web dashboard with live OpenSky/AIS, multi-aircraft view
- **Tier 2 (Cockpit/Operator UI):** Same dashboard, offline-capable, runs on EFB tablet
- **Tier 1 (On-Board):** ← *this PRD* — native Rust binary, no network, runs on embedded avionics computer

This native app is the deployable artifact. It demonstrates that our ML detection isn't locked to a cloud SaaS — it can ship as a binary, run offline, and process GNSS data in real time with low latency and predictable memory.

**This is the demo moment that lands the pitch.** When the judges see a terminal-spawned native window showing real-time spoofing detection on the same data the web dashboard sees, the message is: "this is production-ready, not a hackathon toy."

### ⚠️ Critical: Production vs Demo Architecture (READ THIS BEFORE BUILDING)

**This distinction MUST be clear in the pitch, the README, and any documentation. Confusion here breaks the credibility of the whole project.**

#### Production architecture (what would actually ship to a customer)

```
ON-BOARD                              ON-GROUND
═══════════                           ══════════
  GPS receiver                          ADS-B receivers (OpenSky)
       │                                    │
       ▼                                    ▼
  ARINC 429 bus                         Cloud ingest
       │                                    │
       ▼                                    ▼
  [Native Rust app]                     [FastAPI backend]
       │                                    │
       ▼                                    ▼
  • Cockpit MFD display                 • React web dashboard
  • EGPWS-style audio alert             • Fleet operator screens
  • QAR log (black box)                 • Multi-aircraft view
  • Sporadic ACARS health uplink        • Historical analytics
                                            │
                                            ▼
                                        Insurance, ATC, ops
```

The two tiers **share only the trained model** (the `.onnx` file). They never exchange live data. They never even know the other exists in the deployed system.

The on-board app:
- Reads from the local avionics bus (ARINC 429 in civilian aviation, MIL-STD-1553 in military)
- Runs ML inference locally on the avionics computer
- Outputs to MFD screen, audio alerts, QAR log
- **Does not call any HTTP endpoint, anywhere**
- Optionally sends compressed health summaries to operations via ACARS — but that's outbound only, post-flight, low-bandwidth

#### Demo architecture (what we build for the hackathon)

For Kościuszkon we need to show both tiers reacting **synchronously to the same scenario** so the judges can compare them visually. Without sync, it looks like two unrelated demos.

```
DEMO LAPTOP (single machine)
══════════════════════════════
  Backend reads CSV scenario
       │
       ├──── HTTP/WebSocket ────►   Web dashboard (Tier 3)
       │
       └──── UDP localhost ─────►   Native Rust app (Tier 1)
```

The UDP bridge is **purely a demo scaffold**. In production it does not exist. The native app in production reads from ARINC 429, not from our backend.

#### Why this matters for the judges

Sędziowie z Honeywella znają branżę. Jeśli usłyszą "samolot łączy się z naszym REST API", odetną nas natychmiast — bo to jest fundamentalnie niemożliwe (bandwidth ACARS, certyfikacja, security). Jeśli natomiast usłyszą "ta sama detekcja w dwóch deploymentach, w demo połączone UDP-em na localhoscie, w produkcji niezależne" — kupią to, bo to dokładnie tak działa w realu (np. Honeywell HANA jako embedded vs. Honeywell Forge jako cloud — same model family, separate deployments).

#### Pitch rules

DO say:
- "Same trained model, two deployment modes — on-board and on-ground"
- "On-board reads ARINC 429 in production. In demo we bridge via UDP localhost so you can see both react to the same scenario."
- "Native app is offline-capable, no network dependencies post-deployment"
- "Web dashboard is for ground operations — fleet view, ATC support, post-incident analysis"

DO NOT say:
- ❌ "Aircraft sends alerts to our cloud"
- ❌ "Backend manages the on-board app"
- ❌ "Real-time fleet sync between cockpit and ops"
- ❌ "Same architecture across both tiers" (it's the same MODEL, different ARCHITECTURE)

#### Implementation implication

The native app code MUST work without any backend running. CSV replay mode (`--mode replay`) is the canonical "production-realistic" mode — it simulates reading from a local data source. UDP mode (`--mode live`) is explicitly labeled as a demo bridge.

A small banner in the UI's footer when running in `--mode live`:
> `DEMO BRIDGE • UDP 127.0.0.1:5005 • In production this would be ARINC 429`

This banner makes the architecture honest at first glance. No juror can later say "you misled us."

---

## 1. Goals & Non-Goals

### Goals
1. **Standalone Rust binary** that loads an ONNX-exported XGBoost model and performs local inference
2. **Native GUI window** (egui-based) styled to look like avionics — dark theme, monospace fonts, dim cyan/amber/red accents
3. **Two input modes:** CSV replay (deterministic demo) and UDP listener (live data from backend, parallel to web dashboard)
4. **Real-time visualization:** signal score bars, verdict pill, alert log, position readout, mini-chart of recent verdicts
5. **Audio alert** on CRITICAL — system beep or short WAV
6. **QAR-style logging** — append-only file log of every tick + verdict (mimics Quick Access Recorder)
7. **Predictable performance:** < 5 ms inference latency, < 50 MB RAM, < 10 MB binary size

### Non-Goals (explicitly OUT)
- Real DO-178C compliance (mention as future work, don't pretend)
- Real ARINC 429 / 653 / RTOS integration
- `no_std` or `#![forbid(unsafe_code)]` purity (we want to ship, not lecture)
- Network calls beyond local UDP socket
- Multi-aircraft view (this is the **on-board** console — one platform, one verdict)
- Touch input optimization
- Cross-platform packaging beyond `cargo build --release` on Linux + macOS
- Auto-updates, telemetry, crash reporting
- Replicating the web frontend feature-for-feature

### Definition of Done
- [ ] `cargo run --release` opens a native window without errors on Linux + macOS
- [ ] CSV replay mode plays a scenario from start to finish at 1× speed (configurable 0.25× to 4×)
- [ ] UDP listener mode receives JSON ticks from backend and updates UI live
- [ ] ONNX model produces same verdicts as Python backend on identical inputs (within numerical tolerance)
- [ ] Audio beep fires on CRITICAL transitions, not on every tick
- [ ] QAR log file (`gnss-defense-qar.log`) appends one JSON line per tick
- [ ] Inference latency reported in UI, sustained < 5 ms p95
- [ ] Binary size `cargo build --release` < 15 MB
- [ ] No new console errors or panics during a 5-minute demo run
- [ ] Build instructions in `README.md` work on a clean machine

---

## 2. Tech Stack — Rust crate selection

```toml
# Cargo.toml — pinned versions matching Rust 1.83+ (stable as of late 2025)

[package]
name = "gnss-defense-edge"
version = "0.1.0"
edition = "2021"
rust-version = "1.83"

[dependencies]
# GUI
eframe = "0.30"          # egui + windowing, single crate that "just works"
egui = "0.30"
egui_plot = "0.30"       # for the verdict timeline chart

# ONNX inference
ort = { version = "2.0.0-rc.10", default-features = false, features = ["load-dynamic", "ndarray"] }
ndarray = "0.16"

# Serialization & data
serde = { version = "1", features = ["derive"] }
serde_json = "1"
csv = "1.3"

# Networking (UDP listener)
tokio = { version = "1.42", features = ["rt", "rt-multi-thread", "net", "sync", "time", "macros"] }

# Logging & errors
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt"] }
anyhow = "1"
thiserror = "2"

# Utilities
chrono = { version = "0.4", features = ["serde"] }
parking_lot = "0.12"     # faster Mutex for shared state
crossbeam-channel = "0.5"

# Audio
rodio = { version = "0.20", default-features = false, features = ["wav", "mp3"] }

# CLI
clap = { version = "4", features = ["derive"] }

[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
strip = true
```

### Why these crates

- **`eframe`/`egui`** — immediate-mode GUI, zero web dependencies, single binary, very Rust-idiomatic. egui has clean dark themes, egui_plot for charts, `Slider`, `Button`, `RichText` for monospace styling. Active community, used by `rerun.io` and `pixi`.
- **`ort` (ONNX Runtime)** — official Rust bindings to Microsoft's ONNX Runtime. Loads any ONNX model, runs CPU inference. `load-dynamic` means we ship without bundling 200MB of CUDA — runtime libs loaded from system or local path. Inference latency on tabular XGBoost: < 1ms typical.
- **`tokio`** — UDP socket listener. Even minimal multithreaded runtime is fine; we aren't building a server.
- **`rodio`** — straightforward audio playback for WAV beep. Cross-platform.
- **`clap`** — CLI args (input mode, model path, scenario file, UDP port, audio on/off).

### Out of scope crates that look tempting but are not needed
- `iced` — viable alternative to egui, but egui is faster to set up and well-documented for our use case
- `dioxus` / `tauri` — back to web, not what we want
- `leptos` — server-side reactive, irrelevant
- `tract` — alternative ONNX runtime, pure Rust, no system deps; consider as fallback if `ort` causes packaging issues

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  egui main thread (60 fps render loop)                      │
│  ├─ Reads from shared state (Arc<RwLock<AppState>>)         │
│  ├─ Renders panels: header, scores, alerts, log             │
│  └─ Handles user input (controls, mode toggle)              │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
┌──────────────────┐    ┌──────────────────────┐
│  Tick producer   │    │  Inference worker    │
│  (tokio task)    │───▶│  (dedicated thread)  │
│                  │    │                      │
│  CSV replay OR   │    │  ONNX session        │
│  UDP socket      │    │  Feature → score     │
└──────────────────┘    └────────┬─────────────┘
                                 │
                ┌────────────────┴────────────┐
                ▼                             ▼
        ┌──────────────┐             ┌──────────────┐
        │ Shared state │             │  QAR logger  │
        │ Mutex / RwL  │             │  (sync file) │
        └──────────────┘             └──────────────┘
                                             │
                                             ▼
                                   ┌──────────────────┐
                                   │ Audio player     │
                                   │ (rodio sink)     │
                                   │ on CRIT events   │
                                   └──────────────────┘
```

### Threading model
- **GUI thread** — `eframe::run_native`, owns the rendering loop, must NOT block.
- **Tick producer task** — async tokio task, reads CSV at scenario rate or listens UDP. Pushes raw ticks into a `crossbeam_channel`.
- **Inference worker** — dedicated `std::thread`, owns the ONNX session (which is `!Send` for some configs), pulls from channel, runs `model.run()`, pushes scored results back via another channel.
- **Audio task** — `rodio::Sink` lives in main thread or own thread; receives "play CRIT beep" messages.
- **QAR logger** — synchronous append to file from inference worker. Predictable, no buffering surprises.

Shared state is `Arc<parking_lot::RwLock<AppState>>` updated by the inference worker, read by GUI thread each frame.

### Why not single-threaded?
Even though egui is happy single-threaded, real-time GNSS arrives asynchronously. Inference on the GUI thread would cause frame drops. Channels + worker thread is the canonical pattern and is **realistic** — sędziowie wezmą to za production architecture.

---

## 4. Module Layout

```
gnss-defense-edge/
├── Cargo.toml
├── README.md
├── assets/
│   ├── beep.wav                  # short ~200ms cockpit-style beep
│   ├── critical.wav              # urgent ~600ms warning
│   └── model.onnx                # XGBoost exported (provided by team C)
├── scenarios/
│   ├── normal_waw_gdn.csv
│   ├── texbat_spoof.csv
│   └── aissou_channel_attack.csv
├── src/
│   ├── main.rs                   # entry, CLI parsing, app boot
│   ├── app.rs                    # eframe::App impl, GUI orchestration
│   ├── state.rs                  # AppState struct, all shared data
│   ├── ticks.rs                  # Tick struct, RawTick, ScoredTick
│   ├── inference/
│   │   ├── mod.rs                # InferenceWorker, channel plumbing
│   │   ├── onnx_runner.rs        # ort session wrapper
│   │   └── features.rs           # raw → feature vector mapping
│   ├── feed/
│   │   ├── mod.rs                # FeedSource trait
│   │   ├── csv_replay.rs         # deterministic playback
│   │   └── udp_listener.rs       # listens on 127.0.0.1:5005 by default
│   ├── ui/
│   │   ├── mod.rs                # render entry
│   │   ├── theme.rs              # avionics theme: colors, fonts
│   │   ├── header.rs             # top status strip
│   │   ├── score_panel.rs        # L1/L2 score bars + sparkline
│   │   ├── verdict_panel.rs      # current verdict pill + position
│   │   ├── alert_log.rs          # scrolling alert list
│   │   ├── timeline.rs           # last-N verdicts chart
│   │   └── footer.rs             # mode, latency, build info
│   ├── audio.rs                  # rodio sink + beep dispatcher
│   ├── qar.rs                    # append-only JSONL writer
│   └── cli.rs                    # clap argument structs
└── tests/
    └── inference_parity.rs       # compares ONNX output to expected scores
```

This is roughly 1500-2500 lines of Rust. Achievable in 10-14h with Claude Code if we move fast.

---

## 5. Detailed Module Specs

### 5.1 `src/cli.rs` — entry CLI

```rust
use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(version, about = "GNSS Defense Edge — On-Board Spoofing Detector")]
pub struct Cli {
    /// Path to ONNX model file
    #[arg(long, default_value = "assets/model.onnx")]
    pub model: PathBuf,

    /// Audio mute
    #[arg(long)]
    pub mute: bool,

    /// QAR log file path
    #[arg(long, default_value = "gnss-defense-qar.log")]
    pub qar: PathBuf,

    #[command(subcommand)]
    pub mode: FeedMode,
}

#[derive(Subcommand)]
pub enum FeedMode {
    /// Play back a scenario CSV file
    Replay {
        #[arg(long)]
        scenario: PathBuf,

        /// Speed multiplier (0.25, 0.5, 1.0, 2.0, 4.0)
        #[arg(long, default_value_t = 1.0)]
        speed: f32,

        /// Loop the scenario indefinitely
        #[arg(long)]
        looped: bool,
    },
    /// Listen on UDP port for live ticks (JSON-per-line)
    Live {
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        #[arg(long, default_value_t = 5005)]
        port: u16,
    },
}
```

Demo invocations:
```bash
# Boring baseline
./gnss-defense-edge replay --scenario scenarios/normal_waw_gdn.csv

# Spoof attack at 1×
./gnss-defense-edge replay --scenario scenarios/texbat_spoof.csv

# Slow it down for the pitch
./gnss-defense-edge replay --scenario scenarios/aissou_channel_attack.csv --speed 0.5

# Live, parallel to web dashboard
./gnss-defense-edge live --port 5005
```

### 5.2 `src/ticks.rs` — data types

```rust
use serde::{Deserialize, Serialize};

/// What comes from CSV / UDP. Match backend's tick schema.
#[derive(Debug, Clone, Deserialize)]
pub struct RawTick {
    pub tick: u64,
    pub timestamp: f64,                  // unix seconds
    pub callsign: String,
    pub lat: f64,
    pub lon: f64,
    pub alt_ft: f32,
    pub heading_deg: f32,
    pub gs_kt: f32,
    // L1/L2 raw features — keep names matching backend
    pub cn0_l1: Vec<f32>,                // per-channel C/N0
    pub doppler_l1: Vec<f32>,
    pub cn0_l2: Vec<f32>,
    pub doppler_l2: Vec<f32>,
    pub n_sats: u8,
    pub hdop: f32,
    // Optional: backend can pre-compute features and we skip extraction
    pub features: Option<Vec<f32>>,
}

/// What ONNX inference gives us back, normalized for UI.
#[derive(Debug, Clone, Serialize)]
pub struct ScoredTick {
    pub tick: u64,
    pub timestamp: f64,
    pub callsign: String,
    pub lat: f64,
    pub lon: f64,
    pub alt_ft: f32,
    pub heading_deg: f32,
    pub l1_ratio: f32,                   // 0.0 = clean, 1.0 = threshold, > 1.0 critical
    pub l2_ratio: f32,
    pub verdict: Verdict,
    pub dominant_layer: Layer,
    pub top_reasons: Vec<String>,        // up to 3 explanations
    pub inference_us: u64,               // microseconds — show as ms in UI
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize)]
pub enum Verdict { Ok, Warn, Critical }

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize)]
pub enum Layer { L1, L2, None }
```

### 5.3 `src/inference/onnx_runner.rs`

```rust
use ort::{session::Session, value::Value, environment::Environment};
use ndarray::Array2;
use std::path::Path;
use anyhow::Result;
use std::time::Instant;

pub struct OnnxRunner {
    session: Session,
    threshold_l1: f32,
    threshold_l2: f32,
}

impl OnnxRunner {
    pub fn load(model_path: &Path) -> Result<Self> {
        let session = Session::builder()?
            .commit_from_file(model_path)?;
        Ok(Self {
            session,
            threshold_l1: 0.5,            // tune from backend
            threshold_l2: 0.5,
        })
    }

    pub fn run(&mut self, features: &[f32]) -> Result<(f32, f32, u64)> {
        let n = features.len();
        let input = Array2::from_shape_vec((1, n), features.to_vec())?;
        let inputs = ort::inputs![ "input" => input.view() ]?;

        let start = Instant::now();
        let outputs = self.session.run(inputs)?;
        let elapsed = start.elapsed().as_micros() as u64;

        // Backend exports a model with 2 outputs: prob_l1, prob_l2
        // Adjust based on actual exported model structure
        let probs = outputs[0].try_extract_tensor::<f32>()?;
        let p_l1 = probs[[0, 0]];
        let p_l2 = probs[[0, 1]];

        let r_l1 = p_l1 / self.threshold_l1;
        let r_l2 = p_l2 / self.threshold_l2;
        Ok((r_l1, r_l2, elapsed))
    }
}
```

**Note for Claude Code:** The exact ONNX output schema depends on what Person C exports. Document the assumed schema in `inference/mod.rs` and if it doesn't match, adjust there. Don't fight the runtime — log clear errors.

### 5.4 `src/inference/features.rs` — raw → feature vector

This is the **most fragile** module because feature engineering must match what the model was trained on. Treat as a thin wrapper over a documented contract:

```rust
use crate::ticks::RawTick;

/// Build feature vector matching the order used during training.
/// MUST be kept in sync with backend's feature_extractor.py.
///
/// Order (must match):
/// 0: cn0_l1_mean
/// 1: cn0_l1_std
/// 2: cn0_l1_min
/// 3: doppler_l1_mean
/// ... (document all)
pub fn extract(tick: &RawTick) -> Vec<f32> {
    if let Some(precomputed) = &tick.features {
        return precomputed.clone();
    }

    let mut v = Vec::with_capacity(20);

    // L1 stats
    v.push(mean(&tick.cn0_l1));
    v.push(std(&tick.cn0_l1));
    v.push(tick.cn0_l1.iter().cloned().fold(f32::INFINITY, f32::min));
    v.push(mean(&tick.doppler_l1));
    // ... (etc, mirror backend exactly)

    // L2 stats
    v.push(mean(&tick.cn0_l2));
    v.push(std(&tick.cn0_l2));
    // ...

    // GNSS state
    v.push(tick.n_sats as f32);
    v.push(tick.hdop);

    v
}

fn mean(xs: &[f32]) -> f32 { xs.iter().sum::<f32>() / xs.len().max(1) as f32 }
fn std(xs: &[f32]) -> f32 {
    let m = mean(xs);
    let var = xs.iter().map(|x| (x - m).powi(2)).sum::<f32>() / xs.len().max(1) as f32;
    var.sqrt()
}
```

**Contract with team C:** they hand off:
1. The ONNX file (`assets/model.onnx`)
2. The feature extraction function in Python
3. A small CSV of test inputs and expected scores from Python

We use #3 in `tests/inference_parity.rs` to verify the Rust pipeline produces identical scores to the Python backend.

### 5.5 `src/feed/csv_replay.rs`

Read scenario CSV, push ticks at simulated rate respecting `--speed`.

```rust
use crossbeam_channel::Sender;
use std::path::Path;
use std::time::{Duration, Instant};
use crate::ticks::RawTick;

pub fn run_csv(
    path: &Path,
    speed: f32,
    looped: bool,
    tx: Sender<RawTick>,
) -> anyhow::Result<()> {
    loop {
        let mut rdr = csv::Reader::from_path(path)?;
        let ticks: Vec<RawTick> = rdr.deserialize().collect::<Result<_, _>>()?;
        if ticks.is_empty() { return Ok(()); }

        let start = Instant::now();
        let t0 = ticks[0].timestamp;

        for tick in &ticks {
            let elapsed_sim = (tick.timestamp - t0) / speed as f64;
            let target = Duration::from_secs_f64(elapsed_sim);
            let now = start.elapsed();
            if target > now {
                std::thread::sleep(target - now);
            }
            if tx.send(tick.clone()).is_err() { return Ok(()); }
        }

        if !looped { break; }
    }
    Ok(())
}
```

### 5.6 `src/feed/udp_listener.rs`

Listen on UDP, parse JSON ticks, forward.

```rust
use crossbeam_channel::Sender;
use tokio::net::UdpSocket;
use crate::ticks::RawTick;

pub async fn run_udp(
    host: &str,
    port: u16,
    tx: Sender<RawTick>,
) -> anyhow::Result<()> {
    let sock = UdpSocket::bind((host, port)).await?;
    tracing::info!("UDP listener bound on {}:{}", host, port);
    let mut buf = [0u8; 16 * 1024];

    loop {
        let (n, _peer) = sock.recv_from(&mut buf).await?;
        match serde_json::from_slice::<RawTick>(&buf[..n]) {
            Ok(tick) => { let _ = tx.send(tick); }
            Err(e) => tracing::warn!("bad UDP packet: {e}"),
        }
    }
}
```

Backend integration: a small Python script in the existing backend (NOT in scope here, but document) sends each tick as one UDP packet to `127.0.0.1:5005`. Web dashboard and native app receive same data. **Demo magic.**

### 5.7 `src/ui/theme.rs`

```rust
use egui::{Color32, FontFamily, FontId, Style, Visuals};

pub const HONEYWELL_RED: Color32 = Color32::from_rgb(0xEE, 0x31, 0x24);
pub const VERDICT_OK: Color32 = Color32::from_rgb(0x10, 0xB9, 0x81);
pub const VERDICT_WARN: Color32 = Color32::from_rgb(0xF5, 0x9E, 0x0B);
pub const VERDICT_CRIT: Color32 = Color32::from_rgb(0xEF, 0x44, 0x44);
pub const ACCENT_CYAN: Color32 = Color32::from_rgb(0x22, 0xD3, 0xEE);
pub const ACCENT_VIOLET: Color32 = Color32::from_rgb(0x8B, 0x5C, 0xF6);
pub const BG_PANEL: Color32 = Color32::from_rgb(0x0F, 0x17, 0x2A);
pub const BG_BASE: Color32 = Color32::from_rgb(0x02, 0x06, 0x17);

pub fn install(ctx: &egui::Context) {
    let mut style = (*ctx.style()).clone();
    style.visuals = Visuals::dark();
    style.visuals.window_fill = BG_PANEL;
    style.visuals.panel_fill = BG_BASE;
    style.visuals.override_text_color = Some(Color32::from_rgb(0xF1, 0xF5, 0xF9));

    // Monospace where it matters
    style.text_styles.insert(
        egui::TextStyle::Monospace,
        FontId::new(14.0, FontFamily::Monospace),
    );
    ctx.set_style(style);
}
```

Inspirations: avionics MCDU/PFD displays — dark base, cyan/amber/red accents, monospace for technical readouts, no rounded corners on critical surfaces.

### 5.8 `src/ui/score_panel.rs` — the visual centerpiece

Two side-by-side score bars (L1 / L2) with vertical fill, threshold marker, and a 60-tick sparkline below each.

```rust
use egui::{Ui, Color32, Stroke, Vec2, Pos2, Rect};
use crate::ticks::ScoredTick;
use super::theme::*;

pub fn show(ui: &mut Ui, history: &[ScoredTick]) {
    let Some(latest) = history.last() else {
        ui.label("Awaiting first tick…");
        return;
    };

    ui.horizontal(|ui| {
        score_bar(ui, "L1 SIGNAL (TEXBAT)", latest.l1_ratio, ACCENT_CYAN, history, |t| t.l1_ratio);
        ui.add_space(16.0);
        score_bar(ui, "L2 CHANNEL (AISSOU)", latest.l2_ratio, ACCENT_VIOLET, history, |t| t.l2_ratio);
    });
}

fn score_bar(
    ui: &mut Ui,
    label: &str,
    value: f32,
    color: Color32,
    history: &[ScoredTick],
    f: impl Fn(&ScoredTick) -> f32,
) {
    ui.allocate_ui(Vec2::new(280.0, 220.0), |ui| {
        ui.label(egui::RichText::new(label).monospace().size(13.0));

        let (rect, _resp) = ui.allocate_exact_size(Vec2::new(280.0, 140.0), egui::Sense::hover());
        let painter = ui.painter();
        painter.rect_filled(rect, 4.0, BG_PANEL);

        // threshold lines
        let warn_y = rect.bottom() - rect.height() * 0.5;     // ratio = 1.0
        let crit_y = rect.bottom() - rect.height() * 0.75;    // ratio = 1.5
        painter.line_segment(
            [Pos2::new(rect.left() + 8.0, warn_y), Pos2::new(rect.right() - 8.0, warn_y)],
            Stroke::new(1.0, Color32::from_white_alpha(80)),
        );
        painter.line_segment(
            [Pos2::new(rect.left() + 8.0, crit_y), Pos2::new(rect.right() - 8.0, crit_y)],
            Stroke::new(1.0, VERDICT_CRIT),
        );

        // current value bar
        let h = (value.clamp(0.0, 2.0) / 2.0) * rect.height();
        let bar = Rect::from_min_size(
            Pos2::new(rect.center().x - 32.0, rect.bottom() - h),
            Vec2::new(64.0, h),
        );
        let bar_color = if value > 1.5 { VERDICT_CRIT }
                        else if value > 1.0 { VERDICT_WARN }
                        else { color };
        painter.rect_filled(bar, 2.0, bar_color);

        // numeric readout
        painter.text(
            Pos2::new(rect.center().x, rect.top() + 12.0),
            egui::Align2::CENTER_CENTER,
            format!("{:.2}×", value),
            egui::FontId::monospace(20.0),
            Color32::WHITE,
        );

        // sparkline below
        sparkline(ui, history, &f, color);
    });
}

fn sparkline(ui: &mut Ui, history: &[ScoredTick], f: &impl Fn(&ScoredTick) -> f32, color: Color32) {
    let (rect, _) = ui.allocate_exact_size(Vec2::new(280.0, 50.0), egui::Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 2.0, BG_PANEL);

    let n = history.len().min(60);
    if n < 2 { return; }
    let slice = &history[history.len() - n..];

    let pts: Vec<Pos2> = slice.iter().enumerate().map(|(i, t)| {
        let x = rect.left() + (i as f32 / (n - 1) as f32) * rect.width();
        let v = f(t).clamp(0.0, 2.0) / 2.0;
        let y = rect.bottom() - v * rect.height();
        Pos2::new(x, y)
    }).collect();

    for w in pts.windows(2) {
        painter.line_segment([w[0], w[1]], Stroke::new(1.5, color));
    }
}
```

### 5.9 `src/ui/verdict_panel.rs`

Big bold verdict pill (OK / WARN / CRITICAL) + position readout + heading + altitude.

Style: avionics PFD vibe. Mono font for numbers. Lat/lon in DMS would be most authentic but decimals are fine if shorter on time.

### 5.10 `src/ui/alert_log.rs`

Scrolling list (newest top) of WARNING + CRITICAL events. Each entry:
```
[T+04:23] CRIT  L2 channel saturation, 6/8 channels affected
[T+04:18] WARN  C/N0 anomaly on PRN3
[T+04:12] WARN  Doppler inconsistency (3σ)
```

Fixed height `egui::ScrollArea`, max 200 entries, ring-buffer eviction.

### 5.11 `src/ui/footer.rs` — including the demo bridge banner

Footer contents:
- Left: feed mode (`REPLAY` or `LIVE`), scenario file or UDP endpoint
- Center: **CRITICAL — when `--mode live` is active, render a yellow strip:** `⚠ DEMO BRIDGE • UDP 127.0.0.1:5005 • In production this would be ARINC 429`. This is non-negotiable — see §0 ⚠ section. The banner makes the architecture honest at every glance.
- Right: build version + Kościuszkon 2026 tag, p50/p95 inference latency

```rust
pub fn show(ui: &mut egui::Ui, state: &AppState) {
    ui.horizontal(|ui| {
        match &state.feed_mode {
            FeedModeView::Replay { path, speed } => {
                ui.label(egui::RichText::new(format!("REPLAY · {} · {:.2}×",
                    path.display(), speed)).monospace());
            }
            FeedModeView::Live { endpoint } => {
                ui.label(egui::RichText::new(format!("LIVE · {}", endpoint))
                    .monospace().color(super::theme::ACCENT_CYAN));
                ui.add_space(20.0);
                ui.label(egui::RichText::new(
                    "⚠ DEMO BRIDGE — in production reads ARINC 429"
                ).color(super::theme::VERDICT_WARN));
            }
        }
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(egui::RichText::new("KOŚCIUSZKON 2026").monospace().small());
            ui.label(egui::RichText::new(
                format!("inf p50 {}μs / p95 {}μs", state.lat_p50_us, state.lat_p95_us)
            ).monospace().small());
        });
    });
}
```

### 5.12 `src/ui/timeline.rs`

`egui_plot::Plot` with last 120 ticks as colored squares OK/WARN/CRIT density. Shows attack progression at a glance.

### 5.12 `src/qar.rs`

Append-only JSONL log. Crash-safe, mimics black-box recorder.

```rust
use std::fs::OpenOptions;
use std::io::{Write, BufWriter};
use std::path::Path;
use std::sync::Mutex;
use crate::ticks::ScoredTick;

pub struct QarLogger { writer: Mutex<BufWriter<std::fs::File>> }

impl QarLogger {
    pub fn open(path: &Path) -> anyhow::Result<Self> {
        let file = OpenOptions::new().create(true).append(true).open(path)?;
        Ok(Self { writer: Mutex::new(BufWriter::new(file)) })
    }
    pub fn log(&self, tick: &ScoredTick) -> anyhow::Result<()> {
        let mut w = self.writer.lock().unwrap();
        writeln!(*w, "{}", serde_json::to_string(tick)?)?;
        w.flush()?;
        Ok(())
    }
}
```

### 5.13 `src/audio.rs`

```rust
use rodio::{OutputStream, Sink, Decoder, Source};
use std::sync::Arc;
use parking_lot::Mutex;
use std::io::Cursor;

pub struct Beeper {
    sink: Arc<Mutex<Sink>>,
    _stream: OutputStream,                    // keep alive
    crit_wav: &'static [u8],
}

impl Beeper {
    pub fn new() -> anyhow::Result<Self> {
        let (stream, handle) = OutputStream::try_default()?;
        let sink = Sink::try_new(&handle)?;
        Ok(Self {
            sink: Arc::new(Mutex::new(sink)),
            _stream: stream,
            crit_wav: include_bytes!("../assets/critical.wav"),
        })
    }
    pub fn crit(&self) {
        let s = self.sink.lock();
        let cur = Cursor::new(self.crit_wav);
        if let Ok(src) = Decoder::new(cur) {
            s.append(src);
        }
    }
}
```

Asset files: download CC0 cockpit-style beeps from freesound.org. Document source in `assets/LICENSE.txt`.

### 5.14 `src/app.rs` — orchestration

```rust
use eframe::{App, CreationContext, Frame};
use egui::Context;
use std::sync::Arc;
use parking_lot::RwLock;
use crate::state::AppState;

pub struct GnssDefenseApp {
    state: Arc<RwLock<AppState>>,
    beeper: Option<crate::audio::Beeper>,
    last_verdict: crate::ticks::Verdict,
}

impl GnssDefenseApp {
    pub fn new(_cc: &CreationContext, state: Arc<RwLock<AppState>>) -> Self {
        crate::ui::theme::install(&_cc.egui_ctx);
        Self {
            state,
            beeper: crate::audio::Beeper::new().ok(),
            last_verdict: crate::ticks::Verdict::Ok,
        }
    }
}

impl App for GnssDefenseApp {
    fn update(&mut self, ctx: &Context, _frame: &mut Frame) {
        ctx.request_repaint_after(std::time::Duration::from_millis(16));   // 60fps cap

        let state = self.state.read();

        egui::TopBottomPanel::top("hdr").show(ctx, |ui| crate::ui::header::show(ui, &state));
        egui::TopBottomPanel::bottom("ftr").show(ctx, |ui| crate::ui::footer::show(ui, &state));
        egui::SidePanel::right("alerts").min_width(320.0).show(ctx, |ui| {
            crate::ui::alert_log::show(ui, &state.alert_log);
        });
        egui::CentralPanel::default().show(ctx, |ui| {
            crate::ui::verdict_panel::show(ui, state.history.last());
            ui.separator();
            crate::ui::score_panel::show(ui, &state.history);
            ui.separator();
            crate::ui::timeline::show(ui, &state.history);
        });

        // CRIT escalation → beep
        if let Some(latest) = state.history.last() {
            if latest.verdict == crate::ticks::Verdict::Critical
                && self.last_verdict != crate::ticks::Verdict::Critical
            {
                if let Some(b) = &self.beeper { b.crit(); }
            }
            self.last_verdict = latest.verdict;
        }
    }
}
```

### 5.15 `src/main.rs`

```rust
use clap::Parser;
use std::sync::Arc;
use parking_lot::RwLock;

mod cli; mod state; mod ticks;
mod inference; mod feed; mod ui; mod audio; mod qar; mod app;

fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    let args = cli::Cli::parse();

    let state = Arc::new(RwLock::new(state::AppState::default()));
    let qar = Arc::new(qar::QarLogger::open(&args.qar)?);

    // 1. Spawn inference worker
    let (raw_tx, raw_rx) = crossbeam_channel::bounded(256);
    let state_w = state.clone();
    let qar_w = qar.clone();
    let model_path = args.model.clone();
    std::thread::spawn(move || {
        if let Err(e) = inference::run_worker(&model_path, raw_rx, state_w, qar_w) {
            tracing::error!("inference worker died: {e:?}");
        }
    });

    // 2. Spawn feed
    match args.mode {
        cli::FeedMode::Replay { scenario, speed, looped } => {
            std::thread::spawn(move || {
                let _ = feed::csv_replay::run_csv(&scenario, speed, looped, raw_tx);
            });
        }
        cli::FeedMode::Live { host, port } => {
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    let _ = feed::udp_listener::run_udp(&host, port, raw_tx).await;
                });
            });
        }
    }

    // 3. Run egui
    let opts = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 800.0])
            .with_min_inner_size([960.0, 600.0])
            .with_title("GNSS Defense Edge — Kościuszkon 2026"),
        ..Default::default()
    };
    eframe::run_native(
        "gnss-defense-edge",
        opts,
        Box::new(|cc| Ok(Box::new(app::GnssDefenseApp::new(cc, state)))),
    ).map_err(|e| anyhow::anyhow!("eframe failed: {e}"))?;
    Ok(())
}
```

---

## 6. Implementation Order (10–14h)

### Phase 1 — Boot + window (1.5h)
1. `cargo new gnss-defense-edge --bin`, fill `Cargo.toml`
2. `src/main.rs` opens an empty egui window with title bar
3. Stub `src/cli.rs`, parse flags, log them
4. Add `src/state.rs` with `AppState::default()`
5. Implement `src/ui/theme.rs`, install theme

**Checkpoint:** `cargo run --release -- replay --scenario whatever.csv` opens a dark-themed empty window.

### Phase 2 — CSV feed + dummy inference (2h)
1. `src/ticks.rs` types
2. `src/feed/csv_replay.rs` reads CSV, sends to channel
3. **Dummy inference**: just rotate the score sinusoidally instead of real ONNX, push `ScoredTick` to state
4. Verdict panel shows current verdict + position
5. Timeline shows last 120 ticks as colored squares

**Checkpoint:** Window pulses with fake but plausible OK/WARN/CRIT cycling; mini-timeline visible.

### Phase 3 — Score panels + alert log (2h)
1. `src/ui/score_panel.rs` — bars + sparkline
2. `src/ui/alert_log.rs` — scrolling list with timestamps
3. `src/ui/header.rs` + `src/ui/footer.rs` — status strip + meta

**Checkpoint:** All UI panels populated, looks like "real avionics."

### Phase 4 — ONNX inference (2.5h)
1. `src/inference/onnx_runner.rs` loads `assets/model.onnx`
2. `src/inference/features.rs` extracts vector matching backend training
3. Hook: replace dummy with real `OnnxRunner::run`
4. `tests/inference_parity.rs`: read `parity_fixture.csv` (provided by Person C), assert Rust scores ≈ expected within 1e-4 abs

**Checkpoint:** Real model runs on real CSV scenarios; parity test passes; verdicts match what backend would produce.

### Phase 5 — Audio + QAR (1h)
1. `src/audio.rs` plays critical.wav on first CRIT transition (not every CRIT tick)
2. `src/qar.rs` writes JSONL to `gnss-defense-qar.log`
3. CLI flag `--mute` honored

**Checkpoint:** Beep on CRIT only; QAR file accumulates.

### Phase 6 — UDP listener (1h)
1. `src/feed/udp_listener.rs` parses JSON ticks
2. Add small Python helper script `scripts/udp_emit.py` (~30 lines) that backend can use to mirror ticks
3. Test: native app + web dashboard side-by-side, both react to same ticks

**Checkpoint:** Live mode works, side-by-side demo possible.

### Phase 7 — Polish + acceptance (1.5h)
1. README with build instructions, screenshots
2. Tweak theme details (font sizes, spacing)
3. Verify binary size, latency, RAM
4. Test on macOS + Linux
5. Record fallback demo video

**Phase 8 — Buffer (0.5–1h)** — for whatever broke.

---

## 7. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| ONNX export from XGBoost has unexpected schema | High | Coordinate Person C early. Have parity fixture CSV. If `ort` chokes, fall back to `tract` (pure Rust, no system deps). |
| Feature vector order mismatch Python ↔ Rust | High | Single source of truth: a JSON schema file in repo, both sides reference it. Parity test CATCHES this. |
| `ort` requires system ONNX Runtime libs at runtime | Med | Use `load-dynamic` feature; bundle `libonnxruntime.{so,dylib}` in `assets/`. Document for demo machine. |
| egui rendering on demo laptop's GPU has artifacts | Low | egui has glow + wgpu backends; switch with feature flag if needed |
| Audio fails on Linux (PulseAudio/Pipewire mismatch) | Med | rodio defaults work on most setups; `--mute` flag is the universal fallback |
| Cross-compile to ARM doesn't work in time | Med | Don't try unless Phase 1-7 done. Demo on x86_64 laptop is enough. |
| UDP packets lost or out-of-order | Low | Demo uses localhost; loss is functionally zero |
| Tokio + std::thread mix causes runtime confusion | Med | Pattern in spec is `tokio::Runtime::new + block_on` inside a std thread. Tested pattern. |
| Theme looks "Rust GUI generic" not "avionics" | Med | Spend 20 min on font + spacing tuning in Phase 7. Look at MCDU/PFD references. |
| Inference latency > 5ms on weak laptop | Low | XGBoost on tabular is sub-ms; if it's slow, model file is wrong. |
| Backend's tick CSV doesn't match `RawTick` schema | High | Adapt `RawTick` deserializer to actual CSV; serde with `#[serde(default)]` on optional fields |

---

## 8. Inter-Team Contracts

### From Person C (ML)
1. **`assets/model.onnx`** — XGBoost exported via `onnxmltools` or equivalent. Document input shape and output schema in `inference/mod.rs` doc comment.
2. **`scenarios/*.csv`** — at least 3 scenario CSVs with same columns as backend uses. Headers must match `RawTick` field names exactly.
3. **`tests/parity_fixture.csv`** — 100-1000 rows of inputs and Python-computed scores for parity testing.
4. **Feature extraction documentation** — list of features in order, with their derivation. One-page Markdown.

### From Person B (Backend)
1. Python helper `scripts/udp_emit.py` that reads from existing tick stream and broadcasts JSON to UDP — so demo can run native + web simultaneously.
2. (Optional) An endpoint that streams scenario ticks at controllable speed, for both web and native to consume.

### From Person A (Frontend)
- Nothing required — but if web dashboard adds a "On-Board console" indicator badge showing "native app connected via UDP" it strengthens the demo narrative.

### From Person D (Story)
1. One slide: "Tier 1 — On-Board" with screenshot of native window, latency metric, QAR log preview.
2. Talking-points for the pitch (see §10 below).

---

## 9. Acceptance Tests

Before declaring done, walk through:

1. **Cold build:** `git clone && cargo build --release` succeeds on a fresh machine in < 5 minutes.
2. **Boring scenario:** `--mode replay --scenario normal_waw_gdn.csv` runs to completion, verdict stays OK, no audio fires, QAR log has expected line count.
3. **Spoof scenario:** `--mode replay --scenario texbat_spoof.csv` shows OK→WARN→CRIT transition; one beep fires; alert log populates with reasons.
4. **Speed control:** Same scenario at `--speed 0.25` and `--speed 4.0` — UI keeps up at both.
5. **Live mode:** `cargo run -- live` while running `python scripts/udp_emit.py` from backend — native app updates in lockstep with web dashboard.
6. **Parity:** `cargo test inference_parity` passes — Rust scores match Python within 1e-4.
7. **Latency:** Footer shows p50 inference < 2ms, p95 < 5ms.
8. **Memory:** `ps -o rss` shows < 80 MB after 5-minute run (RAM target 50 MB but allow headroom).
9. **Binary size:** `ls -lh target/release/gnss-defense-edge` < 15 MB (target 10).
10. **Crash test:** Kill backend mid-run in live mode — native app keeps running, shows last-known state, doesn't crash.

---

## 10. Pitch Integration

This is what Person D says when showing this:

> "And here's the same model, running locally, on a binary we could ship inside an aircraft tomorrow. No network. No cloud. No Python interpreter. Five-millisecond inference. Forty megabytes of RAM. The same alert, the same explanation, the same QAR log that black boxes use today. From research notebook to native deployable in twenty-four hours — *that* is software-deployable defense."

Slide content:
- Screenshot of native window during a CRIT alert
- Stats: binary size, latency p95, RAM
- One-line: "Rust + ONNX Runtime. Cross-compiles to ARM. Zero network dependencies."
- Quote from Honeywell HANA October 2025 announcement to anchor the framing

---

## 11. Notes for Claude Code

1. **Read the FE PRD too** — same project, shared theme tokens, shared `Verdict` taxonomy. Don't drift.
2. **Use `cargo check` constantly** — Rust compile errors are verbose; iterate fast.
3. **Don't try to share types Python ↔ Rust via codegen** in this hackathon. Hardcode the struct, document the contract, parity-test it.
4. **Don't bikeshed the GUI**. egui is opinionated; embrace it. Fight it only on theme colors and fonts.
5. **Test with `--release` builds for demo runs.** Debug builds are 100× slower for ONNX inference.
6. **Commit after each phase** with green tests.
7. **`cargo clippy --release -- -D warnings`** before declaring done. No warnings shipped.
8. **Don't unwrap in main()** — use `anyhow::Result` everywhere. Panics on demo are catastrophic.
9. **`ort` API has been changing fast** — pin the version above strictly. If 2.0.0-rc.10 is gone by hackathon time, lock to whatever is current. Verify upstream docs match what's in this PRD.
10. **If anything in §5.x is wrong** because crate APIs evolved — code from this PRD is a SCAFFOLD, not gospel. Adapt freely; preserve the architecture and acceptance tests.

---

## 12. Out of Scope — explicitly NO

- DO-178C, DO-326A, MISRA, ARINC 653 — all "future work" slide content
- `no_std`, `forbid(unsafe_code)`, formal verification
- WebAssembly target
- Mobile (Android/iOS via Tauri or whatever)
- Multi-aircraft / fleet view in native — that's web's job
- Map rendering — native is text/charts only
- Database persistence beyond JSONL log
- Auth, multi-user, network beyond UDP localhost
- Auto-retraining or online learning
- Feature engineering changes — must mirror backend exactly

Stay focused. Ship the binary. Make the judges say "this could go on a 737 next quarter."

---

*Document v1.0 — for Claude Code execution. Tier 1 native console. Companion to FE Upgrade PRD. Date: pre-Kościuszkon 2026.*
