use std::sync::Arc;

use anyhow::Result;
use clap::Parser;
use gnss_defense_edge::{app, cli, feed, inference, qar, state, ticks};
use parking_lot::RwLock;

fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("gnss_defense_edge=info")),
        )
        .init();

    let args = cli::Cli::parse();
    tracing::info!(?args, "starting gnss-defense-edge");

    let state = Arc::new(RwLock::new(state::AppState::new(args.mode.view())));
    let qar = Arc::new(qar::QarLogger::open(&args.qar)?);

    let (raw_tx, raw_rx) = crossbeam_channel::bounded::<ticks::RawTick>(256);

    // Inference worker
    {
        let assets = args.assets_dir.clone();
        let state = state.clone();
        let qar = qar.clone();
        std::thread::Builder::new()
            .name("inference".into())
            .spawn(move || {
                if let Err(e) = inference::run_worker(&assets, raw_rx, state, qar) {
                    tracing::error!(error = %e, "inference worker died");
                }
            })?;
    }

    // Feed
    match args.mode.clone() {
        cli::FeedMode::Replay { scenario, speed, looped } => {
            std::thread::Builder::new()
                .name("csv-feed".into())
                .spawn(move || {
                    if let Err(e) = feed::csv_replay::run_csv(&scenario, speed, looped, raw_tx) {
                        tracing::error!(error = %e, "csv feed died");
                    }
                })?;
        }
        cli::FeedMode::Live { url, scenario, speed } => {
            // Resolve the local CSV (the WS payload doesn't carry raw features).
            let csv_path = args
                .assets_dir
                .parent()
                .unwrap_or_else(|| std::path::Path::new("."))
                .join("scenarios")
                .join(format!("{scenario}.csv"));
            std::thread::Builder::new()
                .name("ws-feed".into())
                .spawn(move || {
                    let rt = match tokio::runtime::Runtime::new() {
                        Ok(rt) => rt,
                        Err(e) => {
                            tracing::error!(error = %e, "tokio runtime failed");
                            return;
                        }
                    };
                    rt.block_on(async {
                        let full = format!(
                            "{}?scenario={}&speed={}",
                            url.trim_end_matches('/'),
                            scenario,
                            speed
                        );
                        if let Err(e) = feed::ws_client::run_ws(&full, &csv_path, raw_tx).await {
                            tracing::error!(error = %e, "ws feed died");
                        }
                    });
                })?;
        }
    }

    let opts = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 800.0])
            .with_min_inner_size([960.0, 600.0])
            .with_title("GNSS Defense Edge — Kościuszkon 2026"),
        ..Default::default()
    };

    let mode = args.mode;
    eframe::run_native(
        "gnss-defense-edge",
        opts,
        Box::new(move |cc| Ok(Box::new(app::GnssDefenseApp::new(cc, state, mode)))),
    )
    .map_err(|e| anyhow::anyhow!("eframe failed: {e}"))?;
    Ok(())
}
