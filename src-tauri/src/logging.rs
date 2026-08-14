//! App / agent log filtering and the dedicated agent file writer.

use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock, RwLock};

use log::{Level, Metadata};
use time::OffsetDateTime;

use crate::mdoels::{AgentLoggingSettings, LogLevelSettings, LoggingSettings};

/// Target used by [`log_fatal`] so `fatal` can be toggled independently of `error`.
pub const FATAL_TARGET: &str = "gensource::fatal";

const MAX_AGENT_LINE_BYTES: usize = 8 * 1024;
const MAX_AGENT_FILE_BYTES: u64 = 10_000_000;

static AGENT_SETTINGS: OnceLock<Arc<RwLock<LoggingSettings>>> = OnceLock::new();
static AGENT_PATH: OnceLock<PathBuf> = OnceLock::new();
static AGENT_FILE: Mutex<Option<AgentFile>> = Mutex::new(None);

struct AgentFile {
    file: File,
    written: u64,
}

/// Content category for an agent log line. `None` is lifecycle / errors (levels only).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentLogKind {
    Prompt,
    Reply,
    Tool,
    Reasoning,
}

/// Whether a log record should be emitted given the live [`LoggingSettings`].
pub fn allows(settings: &LoggingSettings, metadata: &Metadata<'_>) -> bool {
    allows_app(&settings.app, metadata)
}

/// Whether an app-log record should be written under `other/logging/app/`.
pub fn allows_app(settings: &LogLevelSettings, metadata: &Metadata<'_>) -> bool {
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

    allows_level(settings, metadata.level(), false)
}

/// Whether an agent event should be written under `other/logging/agent/`.
pub fn agent_allows(
    settings: &AgentLoggingSettings,
    level: Level,
    fatal: bool,
    kind: Option<AgentLogKind>,
) -> bool {
    if !allows_level(&settings.levels, level, fatal) {
        return false;
    }
    match kind {
        None => true,
        Some(AgentLogKind::Prompt) => settings.prompts,
        Some(AgentLogKind::Reply) => settings.replies,
        Some(AgentLogKind::Tool) => settings.tools,
        Some(AgentLogKind::Reasoning) => settings.reasoning,
    }
}

pub fn allows_level(settings: &LogLevelSettings, level: Level, fatal: bool) -> bool {
    if fatal {
        return settings.fatal;
    }
    match level {
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

/// Write an agent event to `other/logging/agent/` when filters allow it.
#[macro_export]
macro_rules! log_agent {
    ($level:expr, $kind:expr, $conv:expr, $($arg:tt)*) => {
        $crate::logging::emit_agent($level, false, $kind, $conv, &format!($($arg)*))
    };
}

/// Open (lazily) the per-run agent log file. Settings are read live from `logging`.
pub fn init_agent_log(path: PathBuf, settings: Arc<RwLock<LoggingSettings>>) {
    let _ = AGENT_SETTINGS.set(settings);
    let _ = AGENT_PATH.set(path);
}

/// Append one agent log line when [`agent_allows`] says so.
pub fn emit_agent(
    level: Level,
    fatal: bool,
    kind: Option<AgentLogKind>,
    conversation_id: &str,
    message: &str,
) {
    let Some(settings_lock) = AGENT_SETTINGS.get() else {
        return;
    };
    let allowed = match settings_lock.read() {
        Ok(guard) => agent_allows(&guard.agent, level, fatal, kind),
        Err(poisoned) => agent_allows(&poisoned.into_inner().agent, level, fatal, kind),
    };
    if !allowed {
        return;
    }

    let body = truncate_msg(message);
    let kind_label = match kind {
        Some(AgentLogKind::Prompt) => "prompt",
        Some(AgentLogKind::Reply) => "reply",
        Some(AgentLogKind::Tool) => "tool",
        Some(AgentLogKind::Reasoning) => "reasoning",
        None => "event",
    };
    let conv = conversation_id.trim();
    let conv = if conv.is_empty() { "-" } else { conv };
    let line = format!(
        "[{}] {} {} conv={} {}",
        local_stamp(),
        level_label(level, fatal),
        kind_label,
        conv,
        body
    );
    append_agent_line(&line);
}

fn level_label(level: Level, fatal: bool) -> &'static str {
    if fatal {
        return "FATAL";
    }
    match level {
        Level::Error => "ERROR",
        Level::Warn => "WARN",
        Level::Info => "INFO",
        Level::Debug => "DEBUG",
        Level::Trace => "TRACE",
    }
}

fn local_stamp() -> String {
    let now = OffsetDateTime::now_local().unwrap_or_else(|_| OffsetDateTime::now_utc());
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        now.year(),
        u8::from(now.month()),
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
    )
}

fn truncate_msg(msg: &str) -> String {
    let trimmed = redact_secrets(msg.trim());
    if trimmed.len() <= MAX_AGENT_LINE_BYTES {
        return trimmed;
    }
    let mut end = MAX_AGENT_LINE_BYTES;
    while end > 0 && !trimmed.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…", &trimmed[..end])
}

/// Strip API keys, vault passwords, and similar secrets from log / error text.
pub fn redact_secrets(input: &str) -> String {
    let mut out = input.to_string();
    for needle in [
        "gensource_vault_password=",
        "gemini_api_key=",
        "x-goog-api-key=",
        "x-goog-api-key:",
        "api_key=",
        "apikey=",
        "key=",
    ] {
        out = redact_assignment(&out, needle);
    }
    redact_aiza_tokens(&out)
}

fn redact_assignment(input: &str, needle: &str) -> String {
    let lower = input.to_ascii_lowercase();
    let needle_l = needle.to_ascii_lowercase();
    let mut out = String::with_capacity(input.len());
    let mut rest = 0;
    while let Some(rel) = lower[rest..].find(&needle_l) {
        let start = rest + rel;
        out.push_str(&input[rest..start + needle.len()]);
        let value_at = start + needle.len();
        let end = value_end(input, value_at);
        out.push_str("***");
        rest = end;
    }
    out.push_str(&input[rest..]);
    out
}

fn value_end(input: &str, start: usize) -> usize {
    input[start..]
        .find(|c: char| {
            matches!(c, '&' | '"' | '\'' | ',' | ';' | ']' | '}') || c.is_whitespace()
        })
        .map(|i| start + i)
        .unwrap_or(input.len())
}

fn redact_aiza_tokens(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes.len() - i >= 4 && &bytes[i..i + 4] == b"AIza" {
            out.push_str("AIza***");
            i += 4;
            while i < bytes.len() {
                let c = bytes[i];
                if c.is_ascii_alphanumeric() || c == b'_' || c == b'-' {
                    i += 1;
                } else {
                    break;
                }
            }
            continue;
        }
        let ch = input[i..].chars().next().unwrap_or('\0');
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

fn append_agent_line(line: &str) {
    let Some(path) = AGENT_PATH.get() else {
        return;
    };
    let mut guard = match AGENT_FILE.lock() {
        Ok(g) => g,
        Err(poisoned) => poisoned.into_inner(),
    };
    rotate_if_needed(&mut guard, path);
    if guard.is_none() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let Ok(file) = OpenOptions::new().create(true).append(true).open(path) else {
            return;
        };
        let written = file.metadata().map(|m| m.len()).unwrap_or(0);
        *guard = Some(AgentFile { file, written });
    }
    if let Some(af) = guard.as_mut() {
        if writeln!(af.file, "{line}").is_ok() {
            af.written = af.written.saturating_add(line.len() as u64 + 1);
            let _ = af.file.flush();
        }
    }
}

fn rotate_if_needed(slot: &mut Option<AgentFile>, path: &Path) {
    let Some(af) = slot.as_ref() else {
        return;
    };
    if af.written < MAX_AGENT_FILE_BYTES {
        return;
    }
    *slot = None;
    let old = match path.file_stem().and_then(|s| s.to_str()) {
        Some(stem) => path.with_file_name(format!("{stem}.old.log")),
        None => PathBuf::from(format!("{}.old.log", path.display())),
    };
    let _ = fs::remove_file(&old);
    let _ = fs::rename(path, &old);
}

#[cfg(test)]
mod tests {
    use super::*;
    use log::MetadataBuilder;

    fn all_on() -> LoggingSettings {
        let levels = LogLevelSettings {
            error: true,
            warn: true,
            info: true,
            debug: true,
            trace: true,
            fatal: true,
        };
        LoggingSettings {
            app: levels.clone(),
            build: levels.clone(),
            agent: AgentLoggingSettings {
                levels,
                prompts: true,
                replies: true,
                tools: true,
                reasoning: true,
            },
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

    #[test]
    fn app_debug_off_does_not_block_agent_debug() {
        let mut settings = all_on();
        settings.app.debug = false;
        let meta = MetadataBuilder::new()
            .level(Level::Debug)
            .target("app_lib::agent")
            .build();
        assert!(!allows(&settings, &meta));
        assert!(agent_allows(
            &settings.agent,
            Level::Debug,
            false,
            Some(AgentLogKind::Reasoning)
        ));
    }

    #[test]
    fn agent_reasoning_requires_category() {
        let mut settings = all_on();
        settings.agent.reasoning = false;
        assert!(!agent_allows(
            &settings.agent,
            Level::Debug,
            false,
            Some(AgentLogKind::Reasoning)
        ));
        assert!(agent_allows(
            &settings.agent,
            Level::Info,
            false,
            Some(AgentLogKind::Prompt)
        ));
    }

    #[test]
    fn agent_error_uses_level_only() {
        let mut settings = all_on();
        settings.agent.levels.error = false;
        assert!(!agent_allows(&settings.agent, Level::Error, false, None));
        assert!(agent_allows(&settings.agent, Level::Warn, false, None));
    }

    #[test]
    fn redacts_query_key_and_aiza_tokens() {
        let raw = "HttpError: https://generativelanguage.googleapis.com/v1?alt=sse&key=AIzaSyCsecretvalue123";
        let scrubbed = redact_secrets(raw);
        assert!(!scrubbed.contains("AIzaSyCsecretvalue123"), "{scrubbed}");
        assert!(!scrubbed.contains("key=AIza"), "{scrubbed}");
        assert!(scrubbed.contains("key=***"), "{scrubbed}");
    }

    #[test]
    fn redacts_env_style_secrets() {
        let raw = "GEMINI_API_KEY=abc123 GENSOURCE_VAULT_PASSWORD=hunter2";
        let scrubbed = redact_secrets(raw);
        assert!(!scrubbed.contains("abc123"), "{scrubbed}");
        assert!(!scrubbed.contains("hunter2"), "{scrubbed}");
    }
}
