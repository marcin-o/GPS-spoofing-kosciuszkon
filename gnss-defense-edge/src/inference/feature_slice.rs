use std::collections::HashMap;

/// 24 TEXBAT feature columns, in the exact order the L1 model was trained
/// with (matches scripts/generate_scenarios.py:34-45 + the joblib bundle's
/// feature_cols list confirmed at export time).
pub const TEXBAT_FEATURE_ORDER: [&str; 24] = [
    "n_sv",
    "cn0_mean",
    "cn0_std",
    "cn0_min",
    "cn0_max",
    "doppler_std",
    "pseudorange_std",
    "error_flag_any",
    "sqm_peak_mean",
    "sqm_peak_std",
    "sqm_asym_mean",
    "sqm_asym_max",
    "sqm_sec_peak_mean",
    "sqm_sec_peak_max",
    "sqm_left_5_mean",
    "sqm_right_5_mean",
    "power_2MHz",
    "power_4MHz",
    "power_8MHz",
    "clock_error_m",
    "clock_drift_mps",
    "position_drift_m",
    "speed_ecef",
    "clock_error_d_dt",
];

/// 80 AISSOU feature columns: 10 metrics × 8 channels. Same order the L2
/// model was trained with (scripts/generate_scenarios.py:47-51).
pub const AISSOU_METRICS: [&str; 10] = [
    "Carrier_Doppler_hz",
    "Pseudorange_m",
    "Carrier_phase_cycles",
    "EC",
    "LC",
    "PC",
    "PIP",
    "PQP",
    "TCD",
    "CN0",
];

pub fn aissou_feature_order() -> Vec<String> {
    let mut out = Vec::with_capacity(80);
    for metric in AISSOU_METRICS {
        for ch in 0..8 {
            out.push(format!("{metric}_ch{ch}"));
        }
    }
    out
}

pub fn slice_texbat(features: &HashMap<String, f64>) -> anyhow::Result<Vec<f32>> {
    TEXBAT_FEATURE_ORDER
        .iter()
        .map(|&name| {
            features
                .get(name)
                .map(|v| *v as f32)
                .ok_or_else(|| anyhow::anyhow!("missing TEXBAT feature: {name}"))
        })
        .collect()
}

pub fn slice_aissou(features: &HashMap<String, f64>) -> anyhow::Result<Vec<f32>> {
    let order = aissou_feature_order();
    order
        .iter()
        .map(|name| {
            features
                .get(name)
                .map(|v| *v as f32)
                .ok_or_else(|| anyhow::anyhow!("missing AISSOU feature: {name}"))
        })
        .collect()
}
