use egui::{Color32, FontFamily, FontId, Visuals};

// Palette matches the web dashboard's Tailwind-derived tokens so the two
// surfaces look like siblings (slate-950 base, slate-100 text, accent
// amber/emerald/red for verdicts).
pub const BG_BASE: Color32 = Color32::from_rgb(0x02, 0x06, 0x17); // slate-950
pub const BG_PANEL: Color32 = Color32::from_rgb(0x0F, 0x17, 0x2A); // slate-900
pub const BG_PANEL_2: Color32 = Color32::from_rgb(0x1E, 0x29, 0x3B); // slate-800
pub const TEXT: Color32 = Color32::from_rgb(0xF1, 0xF5, 0xF9); // slate-100
pub const TEXT_DIM: Color32 = Color32::from_rgb(0x94, 0xA3, 0xB8); // slate-400

pub const VERDICT_OK: Color32 = Color32::from_rgb(0x10, 0xB9, 0x81); // emerald-500
pub const VERDICT_WARN: Color32 = Color32::from_rgb(0xF5, 0x9E, 0x0B); // amber-500
pub const VERDICT_CRIT: Color32 = Color32::from_rgb(0xEF, 0x44, 0x44); // red-500

pub const ACCENT_CYAN: Color32 = Color32::from_rgb(0x22, 0xD3, 0xEE); // cyan-400
pub const ACCENT_VIOLET: Color32 = Color32::from_rgb(0x8B, 0x5C, 0xF6); // violet-500

pub const HONEYWELL_RED: Color32 = Color32::from_rgb(0xEE, 0x31, 0x24);

pub fn install(ctx: &egui::Context) {
    let mut style = (*ctx.style()).clone();
    let mut visuals = Visuals::dark();
    visuals.window_fill = BG_PANEL;
    visuals.panel_fill = BG_BASE;
    visuals.override_text_color = Some(TEXT);
    visuals.faint_bg_color = BG_PANEL_2;
    visuals.extreme_bg_color = BG_BASE;
    style.visuals = visuals;

    style.text_styles.insert(
        egui::TextStyle::Heading,
        FontId::new(20.0, FontFamily::Proportional),
    );
    style.text_styles.insert(
        egui::TextStyle::Body,
        FontId::new(14.0, FontFamily::Proportional),
    );
    style.text_styles.insert(
        egui::TextStyle::Monospace,
        FontId::new(13.5, FontFamily::Monospace),
    );
    style.text_styles.insert(
        egui::TextStyle::Button,
        FontId::new(13.0, FontFamily::Proportional),
    );

    ctx.set_style(style);
}

pub fn verdict_color(v: crate::ticks::Verdict) -> Color32 {
    match v {
        crate::ticks::Verdict::Ok => VERDICT_OK,
        crate::ticks::Verdict::Warn => VERDICT_WARN,
        crate::ticks::Verdict::Critical => VERDICT_CRIT,
    }
}
