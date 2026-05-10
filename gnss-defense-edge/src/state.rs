use std::collections::VecDeque;
use std::time::Instant;

use crate::cli::FeedModeView;
use crate::ticks::{ScoredTick, Verdict};

const HISTORY_CAP: usize = 600; // 5 min at 2 Hz
const ALERT_CAP: usize = 200;
const LATENCY_CAP: usize = 256;

/// Single source of truth shared between inference worker and GUI thread.
pub struct AppState {
    pub feed_mode: FeedModeView,

    pub history: VecDeque<ScoredTick>,
    pub alert_log: VecDeque<AlertEntry>,
    pub latency_us: VecDeque<u64>,

    pub flash_trigger: Option<Instant>,
    /// Wall-clock when the *current* run of CRITICAL verdicts began. Cleared
    /// the moment a non-CRIT verdict arrives. Used by verdict_panel to show
    /// the "REVERT TO INERTIAL" recommendation once CRIT is sustained.
    pub crit_since: Option<Instant>,
    last_verdict: Verdict,

    pub started: Instant,
    pub ticks_seen: u64,
}

#[derive(Debug, Clone)]
pub struct AlertEntry {
    pub t_int: i64,
    pub verdict: Verdict,
    pub dominant_layer: crate::ticks::Layer,
    pub reason: String,
}

impl AppState {
    pub fn new(feed_mode: FeedModeView) -> Self {
        Self {
            feed_mode,
            history: VecDeque::with_capacity(HISTORY_CAP),
            alert_log: VecDeque::with_capacity(ALERT_CAP),
            latency_us: VecDeque::with_capacity(LATENCY_CAP),
            flash_trigger: None,
            crit_since: None,
            last_verdict: Verdict::Ok,
            started: Instant::now(),
            ticks_seen: 0,
        }
    }

    pub fn push(&mut self, scored: ScoredTick) {
        self.ticks_seen += 1;

        // Latency ring buffer.
        if self.latency_us.len() == LATENCY_CAP {
            self.latency_us.pop_front();
        }
        self.latency_us.push_back(scored.inference_us);

        // CRIT-edge flash + alert log entry.
        if scored.verdict != Verdict::Ok && self.last_verdict != scored.verdict {
            for r in &scored.top_reasons {
                if self.alert_log.len() == ALERT_CAP {
                    self.alert_log.pop_front();
                }
                self.alert_log.push_back(AlertEntry {
                    t_int: scored.t_int,
                    verdict: scored.verdict,
                    dominant_layer: scored.dominant_layer,
                    reason: r.clone(),
                });
            }
        }
        if scored.verdict == Verdict::Critical {
            if self.last_verdict != Verdict::Critical {
                self.flash_trigger = Some(Instant::now());
                self.crit_since = Some(Instant::now());
            }
        } else {
            self.crit_since = None;
        }
        self.last_verdict = scored.verdict;

        if self.history.len() == HISTORY_CAP {
            self.history.pop_front();
        }
        self.history.push_back(scored);
    }

    pub fn latency_p50_p95(&self) -> (u64, u64) {
        if self.latency_us.is_empty() {
            return (0, 0);
        }
        let mut v: Vec<u64> = self.latency_us.iter().copied().collect();
        v.sort_unstable();
        let p50 = v[v.len() / 2];
        let p95 = v[(v.len() * 95 / 100).min(v.len() - 1)];
        (p50, p95)
    }
}
