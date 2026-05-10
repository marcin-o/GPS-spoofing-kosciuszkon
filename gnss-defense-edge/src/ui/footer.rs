use egui::{RichText, Ui};

use crate::cli::FeedModeView;
use crate::state::AppState;

use super::theme::{ACCENT_CYAN, TEXT_DIM, VERDICT_WARN};

pub fn show(ui: &mut Ui, state: &AppState) {
    ui.horizontal(|ui| {
        match &state.feed_mode {
            FeedModeView::Replay { path, speed } => {
                ui.label(
                    RichText::new(format!(
                        "REPLAY · {} · {:.2}×",
                        path.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default(),
                        speed
                    ))
                    .monospace()
                    .color(TEXT_DIM),
                );
            }
            FeedModeView::Live { endpoint } => {
                ui.label(
                    RichText::new(format!("LIVE · {}", endpoint))
                        .monospace()
                        .color(ACCENT_CYAN),
                );
                ui.add_space(16.0);
                ui.label(
                    RichText::new("⚠ DEMO BRIDGE — production reads ARINC 429")
                        .monospace()
                        .color(VERDICT_WARN),
                );
            }
        }

        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(
                RichText::new("KOŚCIUSZKON 2026 · Honeywell")
                    .monospace()
                    .small()
                    .color(TEXT_DIM),
            );
            ui.add_space(12.0);
            let (p50, p95) = state.latency_p50_p95();
            ui.label(
                RichText::new(format!(
                    "infer p50 {} µs · p95 {} µs",
                    p50, p95
                ))
                .monospace()
                .small()
                .color(TEXT_DIM),
            );
        });
    });
}
