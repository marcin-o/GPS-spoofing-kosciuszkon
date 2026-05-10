use std::sync::Arc;

use eframe::{App, CreationContext, Frame};
use egui::Context;
use parking_lot::RwLock;

use crate::cli::FeedMode;
use crate::state::AppState;
use crate::ui;

pub struct GnssDefenseApp {
    state: Arc<RwLock<AppState>>,
    _mode: FeedMode,
}

impl GnssDefenseApp {
    pub fn new(cc: &CreationContext, state: Arc<RwLock<AppState>>, mode: FeedMode) -> Self {
        ui::theme::install(&cc.egui_ctx);
        Self { state, _mode: mode }
    }
}

impl App for GnssDefenseApp {
    fn update(&mut self, ctx: &Context, _frame: &mut Frame) {
        // Run the render loop at ~30fps even when idle so timing-driven
        // animations (flash overlay) are smooth.
        ctx.request_repaint_after(std::time::Duration::from_millis(33));

        let state = self.state.read();

        egui::TopBottomPanel::top("hdr")
            .frame(egui::Frame::none().inner_margin(egui::Margin::symmetric(12.0, 8.0)))
            .show(ctx, |ui| ui::header::show(ui, &state));
        egui::TopBottomPanel::bottom("ftr")
            .frame(egui::Frame::none().inner_margin(egui::Margin::symmetric(12.0, 8.0)))
            .show(ctx, |ui| ui::footer::show(ui, &state));
        egui::SidePanel::right("alerts")
            .resizable(false)
            .min_width(360.0)
            .frame(egui::Frame::none().inner_margin(egui::Margin::symmetric(12.0, 12.0)))
            .show(ctx, |ui| ui::alert_log::show(ui, &state.alert_log));

        egui::CentralPanel::default()
            .frame(egui::Frame::none().inner_margin(egui::Margin::same(16.0)))
            .show(ctx, |ui| {
                ui::verdict_panel::show(ui, state.history.back(), state.crit_since);
                ui.add_space(12.0);
                ui::score_panel::show(ui, &state.history);
                ui.add_space(12.0);
                ui::timeline::show(ui, &state.history);
            });

        ui::flash_overlay::paint(ctx, state.flash_trigger);
    }
}
