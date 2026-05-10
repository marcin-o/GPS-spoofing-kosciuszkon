use std::collections::VecDeque;

use egui::{Pos2, Rect, RichText, Sense, Ui, Vec2};

use crate::ticks::{ScoredTick, Verdict};

use super::theme::{verdict_color, BG_PANEL, TEXT_DIM};

pub fn show(ui: &mut Ui, history: &VecDeque<ScoredTick>) {
    ui.horizontal(|ui| {
        ui.label(
            RichText::new("VERDICT TIMELINE · last 120 ticks")
                .monospace()
                .size(13.0)
                .color(TEXT_DIM),
        );
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            for (label, v) in [
                ("CRIT", Verdict::Critical),
                ("WARN", Verdict::Warn),
                ("OK", Verdict::Ok),
            ] {
                ui.label(RichText::new(label).monospace().small().color(TEXT_DIM));
                let (sw, _) = ui.allocate_exact_size(Vec2::new(10.0, 10.0), Sense::hover());
                ui.painter().rect_filled(sw, 1.0, verdict_color(v));
                ui.add_space(4.0);
            }
        });
    });

    let (rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 40.0), Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 4.0, BG_PANEL);

    let n_show = 120usize;
    let n = history.len().min(n_show);
    if n == 0 {
        return;
    }
    let start = history.len() - n;
    let cell_w = rect.width() / n_show as f32;
    let pad = 1.0_f32;

    for i in 0..n {
        let t = &history[start + i];
        let x = rect.left() + i as f32 * cell_w;
        let cell = Rect::from_min_size(
            Pos2::new(x + pad, rect.top() + pad),
            Vec2::new((cell_w - 2.0 * pad).max(1.0), rect.height() - 2.0 * pad),
        );
        painter.rect_filled(cell, 1.0, verdict_color(t.verdict));
    }
}
