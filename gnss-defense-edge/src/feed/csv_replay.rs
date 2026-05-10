use std::path::Path;
use std::time::{Duration, Instant};

use crossbeam_channel::Sender;

use crate::ticks::RawTick;

pub fn run_csv(
    path: &Path,
    speed: f32,
    looped: bool,
    tx: Sender<RawTick>,
) -> anyhow::Result<()> {
    let speed = speed.max(0.05);

    loop {
        let mut rdr = csv::ReaderBuilder::new()
            .has_headers(true)
            .from_path(path)?;
        let ticks: Vec<RawTick> = rdr.deserialize().collect::<Result<Vec<_>, _>>()?;
        if ticks.is_empty() {
            anyhow::bail!("scenario {} is empty", path.display());
        }
        tracing::info!(file = %path.display(), n = ticks.len(), speed, "csv replay starting");

        let start = Instant::now();
        let t0 = ticks[0].t_int as f64;

        for tick in &ticks {
            let elapsed_sim = (tick.t_int as f64 - t0) / speed as f64;
            let target = Duration::from_secs_f64(elapsed_sim.max(0.0));
            let now = start.elapsed();
            if target > now {
                std::thread::sleep(target - now);
            }
            if tx.send(tick.clone()).is_err() {
                tracing::info!("csv consumer hung up; exiting feed");
                return Ok(());
            }
        }

        if !looped {
            return Ok(());
        }
    }
}
