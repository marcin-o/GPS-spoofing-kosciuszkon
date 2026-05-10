//! Library crate for `gnss-defense-edge` so integration tests can reach
//! into the modules. The CLI entry-point lives in `src/main.rs` and uses
//! these same modules via `use gnss_defense_edge::...`.

pub mod app;
pub mod cli;
pub mod feed;
pub mod inference;
pub mod qar;
pub mod state;
pub mod ticks;
pub mod ui;
