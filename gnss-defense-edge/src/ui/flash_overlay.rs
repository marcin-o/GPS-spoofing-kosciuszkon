use std::time::Instant;

use egui::{Color32, Context, Id, LayerId, Order, Stroke};

use super::theme::VERDICT_CRIT;

const DURATION_MS: f32 = 500.0;

pub fn paint(ctx: &Context, last_trigger: Option<Instant>) {
    let Some(t) = last_trigger else {
        return;
    };
    let elapsed = t.elapsed().as_millis() as f32;
    if elapsed > DURATION_MS {
        return;
    }
    let alpha = (1.0 - elapsed / DURATION_MS).powi(2).clamp(0.0, 1.0);
    let fill_alpha = (alpha * 200.0) as u8;
    let stroke_alpha = (alpha * 255.0) as u8;
    let fill = Color32::from_rgba_unmultiplied(
        VERDICT_CRIT.r(),
        VERDICT_CRIT.g(),
        VERDICT_CRIT.b(),
        fill_alpha,
    );
    let stroke_color = Color32::from_rgba_unmultiplied(
        VERDICT_CRIT.r(),
        VERDICT_CRIT.g(),
        VERDICT_CRIT.b(),
        stroke_alpha,
    );

    let painter = ctx.layer_painter(LayerId::new(Order::Foreground, Id::new("crit-flash")));
    let screen = ctx.screen_rect();
    painter.rect_filled(screen, 0.0, fill);
    painter.rect_stroke(
        screen.shrink(4.0),
        0.0,
        Stroke::new(4.0 * alpha, stroke_color),
    );
    ctx.request_repaint();
}
