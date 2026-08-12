//! App log level filtering helpers shared by the log plugin and config watcher.

use log::{Level, Metadata};

use crate::mdoels::LoggingSettings;

/// Target used by [`log_fatal`] so `fatal` can be toggled independently of `error`.
pub const FATAL_TARGET: &str = "gensource::fatal";

/// Whether a log record should be emitted given the live [`LoggingSettings`].
pub fn allows(settings: &LoggingSettings, metadata: &Metadata<'_>) -> bool {
    if is_fatal_target(metadata.target()) {
        return settings.fatal;
    }

    match metadata.level() {
        Level::Error => settings.error,
        Level::Warn => settings.warn,
        Level::Info => settings.info,
        Level::Debug => settings.debug,
        Level::Trace => settings.trace,
    }
}

fn is_fatal_target(target: &str) -> bool {
    target == FATAL_TARGET || target.starts_with("gensource::fatal::")
}

/// Log a fatal-severity message (Error level + [`FATAL_TARGET`]).
#[macro_export]
macro_rules! log_fatal {
    ($($arg:tt)*) => {
        ::log::error!(target: $crate::logging::FATAL_TARGET, $($arg)*)
    };
}
