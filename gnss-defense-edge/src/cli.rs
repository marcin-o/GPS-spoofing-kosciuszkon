use std::path::PathBuf;

use clap::{Parser, Subcommand};

#[derive(Parser, Debug, Clone)]
#[command(version, about = "GNSS Defense Edge — On-Board Spoofing Detector (Tier 1)")]
pub struct Cli {
    /// Directory with texbat_l1.onnx, aissou_l2.onnx, model_schema.json
    #[arg(long, default_value = "assets")]
    pub assets_dir: PathBuf,

    /// Append-only JSONL log file (QAR-style "black box")
    #[arg(long, default_value = "gnss-defense-qar.log")]
    pub qar: PathBuf,

    #[command(subcommand)]
    pub mode: FeedMode,
}

#[derive(Subcommand, Debug, Clone)]
pub enum FeedMode {
    /// Play back a scenario CSV file (deterministic, demo-realistic)
    Replay {
        /// Path to a scenario CSV (112 columns; see scenarios/ symlink)
        #[arg(long)]
        scenario: PathBuf,

        /// Speed multiplier (e.g. 0.25, 0.5, 1.0, 2.0, 4.0)
        #[arg(long, default_value_t = 1.0)]
        speed: f32,

        /// Loop the scenario indefinitely (for screensaver demos)
        #[arg(long)]
        looped: bool,
    },
    /// Connect to backend's /ws/onboard for synchronized side-by-side demo.
    /// The WS payload doesn't carry raw features, so we use each backend tick
    /// as a clock signal and read features from the local scenario CSV. This
    /// preserves the Tier-1 argument: native still runs ONNX locally.
    Live {
        /// WebSocket URL (scenario + speed are appended as query params)
        #[arg(long, default_value = "ws://127.0.0.1:8000/ws/onboard")]
        url: String,

        /// Scenario id passed as ?scenario=... to the WS endpoint
        /// (must also exist as scenarios/<id>.csv for local feature lookup)
        #[arg(long)]
        scenario: String,

        /// Speed multiplier passed to the WS endpoint
        #[arg(long, default_value_t = 1.0)]
        speed: f32,
    },
}

/// What the footer shows to make the demo-vs-production distinction obvious.
#[derive(Debug, Clone)]
pub enum FeedModeView {
    Replay { path: PathBuf, speed: f32 },
    Live { endpoint: String },
}

impl FeedMode {
    pub fn view(&self) -> FeedModeView {
        match self {
            FeedMode::Replay { scenario, speed, .. } => FeedModeView::Replay {
                path: scenario.clone(),
                speed: *speed,
            },
            FeedMode::Live { url, scenario, speed } => FeedModeView::Live {
                endpoint: format!(
                    "{}?scenario={}&speed={}",
                    url.trim_end_matches('/'),
                    scenario,
                    speed
                ),
            },
        }
    }
}
