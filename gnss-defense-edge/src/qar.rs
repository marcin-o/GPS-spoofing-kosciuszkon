use std::fs::OpenOptions;
use std::io::{BufWriter, Write};
use std::path::Path;

use parking_lot::Mutex;

use crate::ticks::ScoredTick;

/// Append-only JSONL log. Mimics a Quick Access Recorder ("black box"):
/// every tick + verdict goes to disk, flushed line-by-line.
pub struct QarLogger {
    writer: Mutex<BufWriter<std::fs::File>>,
}

impl QarLogger {
    pub fn open(path: &Path) -> anyhow::Result<Self> {
        let file = OpenOptions::new().create(true).append(true).open(path)?;
        Ok(Self {
            writer: Mutex::new(BufWriter::new(file)),
        })
    }

    pub fn log(&self, tick: &ScoredTick) -> anyhow::Result<()> {
        let mut w = self.writer.lock();
        writeln!(*w, "{}", serde_json::to_string(tick)?)?;
        w.flush()?;
        Ok(())
    }
}
