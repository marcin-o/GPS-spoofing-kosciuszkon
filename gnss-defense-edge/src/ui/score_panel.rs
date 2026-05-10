use std::collections::VecDeque;

use egui::{Color32, Pos2, Rect, RichText, Sense, Stroke, Ui, Vec2};

use crate::ticks::ScoredTick;

use super::theme::{ACCENT_CYAN, ACCENT_VIOLET, BG_PANEL, TEXT_DIM, VERDICT_CRIT, VERDICT_WARN};

pub fn show(ui: &mut Ui, history: &VecDeque<ScoredTick>) {
    let latest = history.back();
    ui.horizontal(|ui| {
        score_bar(
            ui,
            "L1 SIGNAL · TEXBAT",
            latest.map(|t| t.ratio_l1).unwrap_or(0.0),
            latest.map(|t| t.prob_l1).unwrap_or(0.0),
            ACCENT_CYAN,
            history,
            |t| t.ratio_l1,
        );
        ui.add_space(16.0);
        score_bar(
            ui,
            "L2 SIGNAL · AISSOU",
            latest.map(|t| t.ratio_l2).unwrap_or(0.0),
            latest.map(|t| t.prob_l2).unwrap_or(0.0),
            ACCENT_VIOLET,
            history,
            |t| t.ratio_l2,
        );
    });
}

fn score_bar(
    ui: &mut Ui,
    label: &str,
    ratio: f32,
    raw_prob: f32,
    color: Color32,
    history: &VecDeque<ScoredTick>,
    f: impl Fn(&ScoredTick) -> f32,
) {
    ui.allocate_ui(Vec2::new(300.0, 220.0), |ui| {
        ui.label(
            RichText::new(label)
                .monospace()
                .size(13.0)
                .color(TEXT_DIM),
        );

        let (rect, _resp) = ui.allocate_exact_size(Vec2::new(300.0, 140.0), Sense::hover());
        let painter = ui.painter();
        painter.rect_filled(rect, 4.0, BG_PANEL);

        // Threshold lines: ratio=1.0 (warn), ratio=1.5 (crit). Range 0..2.
        let warn_y = rect.bottom() - rect.height() * 0.5;
        let crit_y = rect.bottom() - rect.height() * 0.75;
        painter.line_segment(
            [
                Pos2::new(rect.left() + 8.0, warn_y),
                Pos2::new(rect.right() - 8.0, warn_y),
            ],
            Stroke::new(1.0, VERDICT_WARN),
        );
        painter.line_segment(
            [
                Pos2::new(rect.left() + 8.0, crit_y),
                Pos2::new(rect.right() - 8.0, crit_y),
            ],
            Stroke::new(1.0, VERDICT_CRIT),
        );

        // Current bar — give it a visible floor so 0.14× still reads.
        let h = ((ratio.clamp(0.0, 2.0) / 2.0) * rect.height()).max(4.0);
        let bar = Rect::from_min_size(
            Pos2::new(rect.center().x - 36.0, rect.bottom() - h),
            Vec2::new(72.0, h),
        );
        let bar_color = if ratio > 1.5 {
            VERDICT_CRIT
        } else if ratio > 1.0 {
            VERDICT_WARN
        } else {
            color
        };
        painter.rect_filled(bar, 2.0, bar_color);

        // Numeric overlay (top center)
        painter.text(
            Pos2::new(rect.center().x, rect.top() + 14.0),
            egui::Align2::CENTER_CENTER,
            format!("{:.2}×", ratio),
            egui::FontId::monospace(22.0),
            Color32::WHITE,
        );
        painter.text(
            Pos2::new(rect.center().x, rect.top() + 36.0),
            egui::Align2::CENTER_CENTER,
            format!("p={:.3}", raw_prob),
            egui::FontId::monospace(11.0),
            TEXT_DIM,
        );

        sparkline(ui, history, &f, color);
    });
}

fn sparkline(
    ui: &mut Ui,
    history: &VecDeque<ScoredTick>,
    f: &impl Fn(&ScoredTick) -> f32,
    color: Color32,
) {
    let (rect, _) = ui.allocate_exact_size(Vec2::new(300.0, 50.0), Sense::hover());
    let painter = ui.painter();
    painter.rect_filled(rect, 2.0, BG_PANEL);

    let n = history.len().min(60);
    if n < 2 {
        return;
    }
    let start = history.len() - n;

    // Auto-scale so a perpetually low signal (e.g. L1 holding around 0.14×)
    // still draws as a visible line, not a flat strip on the panel edge.
    let mut lo = f32::INFINITY;
    let mut hi = f32::NEG_INFINITY;
    for i in 0..n {
        let v = f(&history[start + i]);
        lo = lo.min(v);
        hi = hi.max(v);
    }
    let span = (hi - lo).max(1e-3);
    let pad = (span * 0.15).max(0.02);
    let lo = lo - pad;
    let hi = hi + pad;
    let inset = 4.0_f32;
    let plot_top = rect.top() + inset;
    let plot_bot = rect.bottom() - inset;
    let plot_h = plot_bot - plot_top;

    let pts: Vec<Pos2> = (0..n)
        .map(|i| {
            let t = &history[start + i];
            let v = ((f(t) - lo) / (hi - lo)).clamp(0.0, 1.0);
            let x = rect.left() + (i as f32 / (n - 1) as f32) * rect.width();
            let y = plot_bot - v * plot_h;
            Pos2::new(x, y)
        })
        .collect();

    for w in pts.windows(2) {
        painter.line_segment([w[0], w[1]], Stroke::new(1.5, color));
    }
}
