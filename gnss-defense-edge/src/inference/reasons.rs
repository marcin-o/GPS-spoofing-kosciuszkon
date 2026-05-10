use crate::ticks::{Layer, RawTick};

/// Rule-based "top reasons" — deterministic heuristics over the same raw
/// features the ONNX models consume. Not real SHAP. Keeps the demo honest:
/// thresholds tuned by eyeballing scenario CSVs, not learned.
pub fn top_reasons(layer: Layer, tick: &RawTick) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let f = |name: &str| tick.features.get(name).copied().unwrap_or(0.0);

    match layer {
        Layer::L1 => {
            let cn0_std = f("cn0_std");
            if cn0_std > 5.0 {
                out.push(format!(
                    "C/N0 spread {:.1} dB-Hz — uneven channel response",
                    cn0_std
                ));
            }
            let pseudo_std = f("pseudorange_std");
            if pseudo_std > 50.0 {
                out.push(format!(
                    "Pseudorange residual σ {:.0} m — geometry inconsistent",
                    pseudo_std
                ));
            }
            let pos_drift = f("position_drift_m");
            if pos_drift.abs() > 200.0 {
                out.push(format!(
                    "Position drift {:.0} m — track diverging from inertial",
                    pos_drift
                ));
            }
            let clock_drift = f("clock_drift_mps");
            if clock_drift.abs() > 5.0 {
                out.push(format!(
                    "Clock drift {:.1} m/s — receiver oscillator under attack",
                    clock_drift
                ));
            }
            let n_sv = f("n_sv");
            if n_sv > 0.0 && n_sv < 6.0 {
                out.push(format!(
                    "Only {} satellites tracked — possible signal capture",
                    n_sv as i32
                ));
            }
        }
        Layer::L2 => {
            // Pick worst channel by abs Carrier_Doppler_hz, then worst by TCD,
            // then worst by CN0 deviation.
            if let Some((ch, val)) = worst_channel(tick, "Carrier_Doppler_hz", 1500.0) {
                out.push(format!(
                    "Channel {ch}: Doppler {val:.0} Hz outside training distribution"
                ));
            }
            if let Some((ch, val)) = worst_channel(tick, "TCD", 0.5) {
                out.push(format!("Channel {ch}: tracking-loop divergence (TCD={val:.2})"));
            }
            if let Some((ch, val)) = lowest_channel(tick, "CN0", 30.0) {
                out.push(format!("Channel {ch}: C/N0 {val:.1} dB-Hz under floor"));
            }
            if out.is_empty() {
                out.push("Multi-channel correlator anomaly across L2 PRN set".to_string());
            }
        }
        Layer::None => {}
    }

    if out.is_empty() {
        out.push(format!("{} model output above threshold", layer.label()));
    }
    out.truncate(3);
    out
}

fn worst_channel(tick: &RawTick, metric: &str, threshold: f64) -> Option<(usize, f64)> {
    (0..8)
        .map(|ch| {
            let key = format!("{metric}_ch{ch}");
            let v = tick.features.get(&key).copied().unwrap_or(0.0);
            (ch, v.abs())
        })
        .filter(|(_, v)| *v > threshold)
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(ch, v)| {
            // Return signed value for nicer display.
            let key = format!("{metric}_ch{ch}");
            let signed = tick.features.get(&key).copied().unwrap_or(v);
            (ch, signed)
        })
}

fn lowest_channel(tick: &RawTick, metric: &str, floor: f64) -> Option<(usize, f64)> {
    (0..8)
        .map(|ch| {
            let key = format!("{metric}_ch{ch}");
            let v = tick.features.get(&key).copied().unwrap_or(f64::INFINITY);
            (ch, v)
        })
        .filter(|(_, v)| *v < floor && *v > 0.0)
        .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
}
