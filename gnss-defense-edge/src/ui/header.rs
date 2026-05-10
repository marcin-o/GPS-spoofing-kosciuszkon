use egui::{RichText, Ui};

use crate::state::AppState;

use super::theme::{ACCENT_CYAN, ACCENT_RED, TEXT_DIM};

pub fn show(ui: &mut Ui, state: &AppState) {
    ui.horizontal(|ui| {
        ui.label(RichText::new("BEDETECTOR").strong().monospace().size(16.0).color(ACCENT_RED));
        ui.add_space(12.0);
        ui.label(RichText::new("Konsola pokładowa · Tier 1").monospace().color(TEXT_DIM));
        ui.add_space(20.0);
        if let Some(latest) = state.history.back() {
            ui.label(
                RichText::new(format!("CALLSIGN  {}", latest.callsign))
                    .monospace()
                    .color(ACCENT_CYAN),
            );
            ui.add_space(12.0);
            ui.label(
                RichText::new(format!("T+{:>4}s", latest.t_int))
                    .monospace()
                    .color(TEXT_DIM),
            );
        } else {
            ui.label(RichText::new("Oczekuję pierwszego ticka…").italics().color(TEXT_DIM));
        }

        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            let elapsed = state.started.elapsed();
            ui.label(
                RichText::new(format!("UPTIME {:>4}s", elapsed.as_secs()))
                    .monospace()
                    .color(TEXT_DIM),
            );
            ui.add_space(8.0);
            ui.label(
                RichText::new(format!("TICKS {}", state.ticks_seen))
                    .monospace()
                    .color(TEXT_DIM),
            );
        });
    });
}
