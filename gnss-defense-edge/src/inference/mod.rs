pub mod dual_runner;
pub mod feature_slice;
pub mod reasons;

use std::path::Path;
use std::sync::Arc;

use crossbeam_channel::Receiver;
use parking_lot::RwLock;

use crate::qar::QarLogger;
use crate::state::AppState;
use crate::ticks::{Layer, RawTick, ScoredTick, Verdict};

pub fn run_worker(
    assets_dir: &Path,
    rx: Receiver<RawTick>,
    state: Arc<RwLock<AppState>>,
    qar: Arc<QarLogger>,
) -> anyhow::Result<()> {
    let mut runner = dual_runner::DualRunner::load(assets_dir)?;
    let (t1, t2) = runner.thresholds();
    tracing::info!(threshold_l1 = t1, threshold_l2 = t2, "ONNX models loaded");

    while let Ok(tick) = rx.recv() {
        let l1 = match feature_slice::slice_texbat(&tick.features) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(error = %e, "TEXBAT slice failed; skipping tick");
                continue;
            }
        };
        let l2 = match feature_slice::slice_aissou(&tick.features) {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(error = %e, "AISSOU slice failed; skipping tick");
                continue;
            }
        };

        let (p_l1, p_l2, elapsed_us) = runner.run(&l1, &l2)?;

        let r_l1 = if t1 > 0.0 { p_l1 / t1 } else { 0.0 };
        let r_l2 = if t2 > 0.0 { p_l2 / t2 } else { 0.0 };

        let dominant = if r_l1 >= r_l2 { Layer::L1 } else { Layer::L2 };
        let max_r = r_l1.max(r_l2);
        let verdict = Verdict::from_max_ratio(max_r);
        let top_reasons = if verdict == Verdict::Ok {
            Vec::new()
        } else {
            reasons::top_reasons(dominant, &tick)
        };

        let scored = ScoredTick {
            tick: tick.tick,
            t_int: tick.t_int,
            callsign: tick.callsign.clone(),
            lat: tick.lat,
            lon: tick.lon,
            alt: tick.alt,
            heading: tick.heading,
            is_attack: tick.is_attack,
            prob_l1: p_l1,
            prob_l2: p_l2,
            ratio_l1: r_l1,
            ratio_l2: r_l2,
            verdict,
            dominant_layer: dominant,
            top_reasons,
            inference_us: elapsed_us,
        };

        if let Err(e) = qar.log(&scored) {
            tracing::warn!(error = %e, "QAR write failed");
        }
        state.write().push(scored);
    }
    Ok(())
}
