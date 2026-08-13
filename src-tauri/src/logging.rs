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

    // The `wmi` crate logs every CoCreateInstance / ConnectServer at DEBUG.
    // With metrics polling ~1Hz that floods stdout; keep app diagnostics only.
    if is_noisy_dependency_target(metadata.target())
        && matches!(metadata.level(), Level::Debug | Level::Trace)
    {
        return false;
    }

    match metadata.level() {
        Level::Error => settings.error,
        Level::Warn => settings.warn,
        Level::Info => settings.info,
        Level::Debug => settings.debug,
        Level::Trace => settings.trace,
    }
}

fn is_noisy_dependency_target(target: &str) -> bool {
    target == "wmi" || target.starts_with("wmi::")
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

#[cfg(test)]
mod tests {
    use super::*;
    use log::MetadataBuilder;

    fn all_on() -> LoggingSettings {
        LoggingSettings {
            error: true,
            warn: true,
            info: true,
            debug: true,
            trace: true,
            fatal: true,
        }
    }

    #[test]
    fn suppresses_wmi_crate_debug_noise() {
        let settings = all_on();
        let meta = MetadataBuilder::new()
            .level(Level::Debug)
            .target("wmi::connection")
            .build();
        assert!(!allows(&settings, &meta));
    }

    #[test]
    fn still_allows_app_debug() {
        let settings = all_on();
        let meta = MetadataBuilder::new()
            .level(Level::Debug)
            .target("app_lib::metrics::thermal::windows_thermal")
            .build();
        assert!(allows(&settings, &meta));
    }
}
