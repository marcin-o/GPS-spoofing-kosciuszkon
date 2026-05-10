use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use crossbeam_channel::Sender;
use futures_util::StreamExt;
use serde::Deserialize;
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::ticks::RawTick;

/// Backend's /ws/onboard payload — only the fields we use to drive replay.
/// Everything else (position, scores.{L1,L2}, verdict, top_reasons) is
/// silently ignored by serde, which is the entire point: we re-derive
/// inference locally from the same scenario CSV the backend reads.
#[derive(Debug, Deserialize)]
struct WsTickHeader {
    #[serde(default)]
    effective_tick: usize,
    #[serde(default)]
    scenario_id: String,
    #[serde(default)]
    error: Option<String>,
}

pub async fn run_ws(
    url: &str,
    csv_path: &Path,
    tx: Sender<RawTick>,
) -> anyhow::Result<()> {
    tracing::info!(url, csv = %csv_path.display(), "ws live mode connecting");

    let mut rdr = csv::ReaderBuilder::new().has_headers(true).from_path(csv_path)?;
    let ticks: Vec<RawTick> = rdr.deserialize().collect::<Result<Vec<_>, _>>()?;
    if ticks.is_empty() {
        anyhow::bail!("scenario CSV at {} is empty", csv_path.display());
    }
    tracing::info!(rows = ticks.len(), "loaded local scenario for live mode");

    let (mut stream, _resp) = connect_async(url).await?;
    tracing::info!("ws connected");

    static FIRST: AtomicBool = AtomicBool::new(true);

    while let Some(msg) = stream.next().await {
        match msg? {
            Message::Text(text) => {
                let header: WsTickHeader = match serde_json::from_str(&text) {
                    Ok(h) => h,
                    Err(e) => {
                        tracing::warn!(error = %e, "ws parse failed");
                        continue;
                    }
                };
                if let Some(err) = header.error {
                    anyhow::bail!("ws backend error: {err}");
                }
                if FIRST.swap(false, Ordering::Relaxed) {
                    tracing::info!(
                        scenario = %header.scenario_id,
                        "ignoring backend's pre-computed scores; running local ONNX inference"
                    );
                }

                let idx = header.effective_tick.min(ticks.len() - 1);
                if tx.send(ticks[idx].clone()).is_err() {
                    tracing::info!("ws consumer hung up; exiting feed");
                    break;
                }
            }
            Message::Close(_) => {
                tracing::info!("ws closed by peer");
                break;
            }
            _ => {}
        }
    }
    Ok(())
}
