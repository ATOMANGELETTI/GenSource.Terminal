//! IPC command modules. Handlers live in `commands.rs` and domain-specific
//! files such as `explorer.rs`; re-export so `lib.rs` can register them as
//! `commands::…`.

#[path = "commands.rs"]
mod handlers;
mod explorer;

pub use explorer::*;
pub use handlers::*;
