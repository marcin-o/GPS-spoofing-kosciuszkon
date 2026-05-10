use std::collections::VecDeque;

use egui::{RichText, ScrollArea, Ui};

use crate::state::AlertEntry;

use super::theme::{verdict_color, TEXT_DIM};

pub fn show(ui: &mut Ui, log: &VecDeque<AlertEntry>) {
    ui.label(
        RichText::new("ALERTS")
            .strong()
            .monospace()
            .size(14.0)
            .color(TEXT_DIM),
    );
    ui.separator();

    if log.is_empty() {
        ui.label(RichText::new("— no alerts —").italics().color(TEXT_DIM));
        return;
    }

    ScrollArea::vertical()
        .max_height(f32::INFINITY)
        .stick_to_bottom(true)
        .show(ui, |ui| {
            for entry in log.iter().rev() {
                let badge = format!(
                    "[T+{:>4}s] {:>4}  {:<8}",
                    entry.t_int,
                    entry.dominant_layer.label(),
                    entry.verdict.label()
                );
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(badge)
                            .monospace()
                            .color(verdict_color(entry.verdict)),
                    );
                });
                ui.label(
                    RichText::new(&entry.reason)
                        .monospace()
                        .small()
                        .color(TEXT_DIM),
                );
                ui.add_space(4.0);
            }
        });
}
