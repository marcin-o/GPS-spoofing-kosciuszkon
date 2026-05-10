use std::time::Instant;

use egui::{Color32, RichText, Ui};

use crate::ticks::{ScoredTick, Verdict};

use super::theme::{verdict_color, BG_PANEL_2, TEXT_DIM, VERDICT_CRIT};

const REVERT_THRESHOLD_S: u64 = 30;

pub fn show(ui: &mut Ui, latest: Option<&ScoredTick>, crit_since: Option<Instant>) {
    let (label, color, lat, lon, alt, hdg, layer, callsign) = match latest {
        Some(t) => (
            t.verdict.label(),
            verdict_color(t.verdict),
            t.lat,
            t.lon,
            t.alt,
            t.heading,
            t.dominant_layer.label(),
            t.callsign.as_str(),
        ),
        None => (
            "INIT",
            Color32::GRAY,
            0.0,
            0.0,
            0.0,
            0.0,
            "—",
            "—",
        ),
    };

    egui::Frame::none()
        .fill(BG_PANEL_2)
        .inner_margin(egui::Margin::same(14.0))
        .rounding(egui::Rounding::same(6.0))
        .show(ui, |ui| {
            ui.horizontal(|ui| {
                // Big verdict pill on the left
                let pill = RichText::new(label)
                    .strong()
                    .monospace()
                    .size(40.0)
                    .color(color);
                ui.allocate_ui(egui::vec2(320.0, 96.0), |ui| {
                    ui.label(pill);
                    ui.label(
                        RichText::new(format!("dominant layer · {}", layer))
                            .monospace()
                            .color(TEXT_DIM),
                    );
                    // Avionics-style recommendation once CRIT is sustained.
                    // Anchors a quiet Honeywell namedrop ("INERTIAL" → LASEREF VI).
                    if let Some(t0) = crit_since {
                        let secs = t0.elapsed().as_secs();
                        if secs >= REVERT_THRESHOLD_S
                            && latest.map(|t| t.verdict == Verdict::Critical).unwrap_or(false)
                        {
                            ui.label(
                                RichText::new(format!(
                                    "RECOMMEND: REVERT TO INERTIAL · {}s",
                                    secs
                                ))
                                .monospace()
                                .strong()
                                .color(VERDICT_CRIT),
                            );
                        }
                    }
                });

                ui.separator();

                // Position readout on the right
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(format!("CALLSIGN   {}", callsign))
                            .monospace()
                            .size(15.0),
                    );
                    ui.label(
                        RichText::new(format!("LAT  {:>10.5}°", lat))
                            .monospace()
                            .size(15.0),
                    );
                    ui.label(
                        RichText::new(format!("LON  {:>10.5}°", lon))
                            .monospace()
                            .size(15.0),
                    );
                    ui.label(
                        RichText::new(format!("ALT  {:>7.0} m   HDG  {:>5.1}°", alt, hdg))
                            .monospace()
                            .size(15.0),
                    );
                });
            });
        });
}
