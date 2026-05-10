use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// One row of a scenario CSV (or one feature-equivalent unit pulled from a
/// WS-driven Live feed). Backend writes 112 columns: 8 metadata + 24 TEXBAT
/// + 80 AISSOU. Names must match the headers in scripts/generate_scenarios.py.
///
/// We deserialize metadata explicitly and gather everything else into a
/// `HashMap<String, f64>` so feature-order is enforced by the slicer constants
/// in inference/feature_slice.rs (the single source of truth) rather than
/// duplicated in the struct definition.
#[derive(Debug, Clone, Deserialize)]
pub struct RawTick {
    pub tick: u64,
    pub t_int: i64,
    pub callsign: String,
    pub lat: f64,
    pub lon: f64,
    #[serde(default)]
    pub alt: f32,
    #[serde(default)]
    pub heading: f32,
    #[serde(default)]
    pub is_attack: u8,
    #[serde(flatten)]
    pub features: HashMap<String, f64>,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Verdict {
    Ok,
    Warn,
    Critical,
}

impl Verdict {
    pub fn from_max_ratio(r: f32) -> Self {
        if r >= 1.5 {
            Verdict::Critical
        } else if r >= 1.0 {
            Verdict::Warn
        } else {
            Verdict::Ok
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Verdict::Ok => "OK",
            Verdict::Warn => "WARNING",
            Verdict::Critical => "CRITICAL",
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Layer {
    L1,
    L2,
    None,
}

impl Layer {
    pub fn label(self) -> &'static str {
        match self {
            Layer::L1 => "L1",
            Layer::L2 => "L2",
            Layer::None => "—",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ScoredTick {
    pub tick: u64,
    pub t_int: i64,
    pub callsign: String,
    pub lat: f64,
    pub lon: f64,
    pub alt: f32,
    pub heading: f32,
    pub is_attack: u8,

    pub prob_l1: f32,
    pub prob_l2: f32,
    pub ratio_l1: f32,
    pub ratio_l2: f32,
    pub verdict: Verdict,
    pub dominant_layer: Layer,
    pub top_reasons: Vec<String>,
    pub inference_us: u64,
}
