//! Shared data models. Note: this directory is intentionally named `mdoels`
//! (a pre-existing typo in the template); preserve it unless asked to rename.

use serde::{Deserialize, Serialize};

/// Basic metadata about the running application, exposed to the frontend
/// via the `get_app_info` command. Prefer values from `appinfo.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub product_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub publisher: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub codename: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edition: Option<u16>,
}

/// On-disk `other/configs/appinfo.json` shape (read-only at runtime).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfoFile {
    pub name: String,
    #[serde(default)]
    pub product_name: String,
    #[serde(default)]
    pub identifier: String,
    pub version: String,
    #[serde(default)]
    pub publisher: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub codename: String,
    #[serde(default)]
    pub edition: Option<u16>,
}

impl AppInfoFile {
    pub fn into_app_info(self) -> AppInfo {
        AppInfo {
            name: self.name,
            version: self.version,
            description: if self.description.trim().is_empty() {
                None
            } else {
                Some(self.description)
            },
            product_name: if self.product_name.trim().is_empty() {
                None
            } else {
                Some(self.product_name)
            },
            identifier: if self.identifier.trim().is_empty() {
                None
            } else {
                Some(self.identifier)
            },
            publisher: if self.publisher.trim().is_empty() {
                None
            } else {
                Some(self.publisher)
            },
            codename: if self.codename.trim().is_empty() {
                None
            } else {
                Some(self.codename)
            },
            edition: self.edition,
        }
    }
}

/// A shell profile from `settings.json` `profiles` (resolved by id at spawn).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProfile {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub starting_directory: Option<String>,
}

fn default_profiles() -> Vec<TerminalProfile> {
    vec![
        TerminalProfile {
            id: "powershell".into(),
            name: "PowerShell".into(),
            command: "powershell.exe".into(),
            args: vec!["-NoLogo".into()],
            starting_directory: None,
        },
        TerminalProfile {
            id: "cmd".into(),
            name: "CMD".into(),
            command: "cmd.exe".into(),
            args: Vec::new(),
            starting_directory: None,
        },
    ]
}

fn default_default_profile() -> String {
    "powershell".into()
}

fn default_scrollback_lines() -> f64 {
    5000.0
}

fn default_cursor_style() -> String {
    "bar".into()
}

fn default_cursor_blink() -> bool {
    true
}

/// On-disk `other/configs/settings.json` shape.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: f64,
    #[serde(default = "default_particle_effect")]
    pub particle_effect: String,
    #[serde(default)]
    pub start_minimized: bool,
    #[serde(default)]
    pub autostart: bool,
    #[serde(default)]
    pub always_on_top: bool,
    #[serde(default = "default_default_profile")]
    pub default_profile: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terminal_font_family: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terminal_font_size: Option<f64>,
    #[serde(default = "default_scrollback_lines")]
    pub scrollback_lines: f64,
    #[serde(default = "default_cursor_style")]
    pub cursor_style: String,
    #[serde(default = "default_cursor_blink")]
    pub cursor_blink: bool,
    #[serde(default = "default_file_icon_set")]
    pub file_icon_set: String,
    #[serde(default = "default_profiles")]
    pub profiles: Vec<TerminalProfile>,
}

fn default_theme() -> String {
    "nord-polar-night".into()
}

fn default_font_family() -> String {
    "Terminus".into()
}

fn default_font_size() -> f64 {
    14.0
}

fn default_particle_effect() -> String {
    "dust".into()
}

fn default_file_icon_set() -> String {
    "catppuccin".into()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            font_family: default_font_family(),
            font_size: default_font_size(),
            particle_effect: default_particle_effect(),
            start_minimized: false,
            autostart: false,
            always_on_top: false,
            default_profile: default_default_profile(),
            terminal_font_family: None,
            terminal_font_size: None,
            scrollback_lines: default_scrollback_lines(),
            cursor_style: default_cursor_style(),
            cursor_blink: default_cursor_blink(),
            file_icon_set: default_file_icon_set(),
            profiles: default_profiles(),
        }
    }
}

/// IPC: `pty_create` args (camelCase from frontend).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyCreateArgs {
    pub profile_id: String,
    pub cols: u16,
    pub rows: u16,
    /// Optional one-shot working directory (overrides profile `startingDirectory`).
    #[serde(default)]
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySessionIdArgs {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyWriteArgs {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyResizeArgs {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyCreateResult {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyOutputEvent {
    pub session_id: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyExitEvent {
    pub session_id: String,
    pub code: Option<i32>,
}

/// Whether a keybinding is registered as an OS-wide global shortcut (fires
/// even when the app isn't focused) or only handled in-app while the
/// window that owns the shortcut has focus. Common editing/clipboard keys
/// (Reload, Copy, Paste, ...) must stay `local` — registering them globally
/// would hijack those keys for every other application on the system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeybindingScope {
    Global,
    Local,
}

impl Default for KeybindingScope {
    fn default() -> Self {
        KeybindingScope::Local
    }
}

/// A single shortcut binding from `keybindings.json`. Global-scope bindings
/// are registered with `tauri-plugin-global-shortcut`; local-scope bindings
/// are only read by the frontend (for menu shortcut labels and an in-app
/// `keydown` dispatcher).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Keybinding {
    pub id: String,
    pub shortcut: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub scope: KeybindingScope,
}

fn default_true() -> bool {
    true
}

/// On-disk `other/configs/keybindings.json` shape.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingsFile {
    #[serde(default)]
    pub bindings: Vec<Keybinding>,
}

/// On-disk `other/configs/logging.json` shape — independent per-level toggles
/// for file logging under `other/logging/app/`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoggingSettings {
    #[serde(default = "default_true")]
    pub error: bool,
    #[serde(default = "default_true")]
    pub warn: bool,
    #[serde(default = "default_true")]
    pub info: bool,
    #[serde(default)]
    pub debug: bool,
    #[serde(default)]
    pub trace: bool,
    /// Separate channel for `log_fatal!` (Error level + `gensource::fatal` target).
    #[serde(default = "default_true")]
    pub fatal: bool,
}

impl Default for LoggingSettings {
    fn default() -> Self {
        Self {
            error: true,
            warn: true,
            info: true,
            debug: false,
            trace: false,
            fatal: true,
        }
    }
}

/// Files Explorer entry kind (`fs_list_drives` / `fs_list_dir` / `fs_entry_info`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FsEntryKind {
    Drive,
    Dir,
    File,
}

/// Serialized filesystem entry for the Files Explorer panel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub kind: FsEntryKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// RFC3339 timestamp when available.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modified: Option<String>,
}

/// Snapshot from `get_system_metrics` (status-bar CPU / GPU / RAM / net).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemMetrics {
    pub cpu_percent: f32,
    /// `None` when GPU counters are unavailable (non-Windows or PDH failure).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gpu_percent: Option<f32>,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub net_up_bps: f64,
    pub net_down_bps: f64,
    /// Package / thermal-zone proxy (°C). `None` when WMI sensors are unavailable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cpu_temp_celsius: Option<f32>,
    /// Vendor GPU die temp (°C) when exposed via WMI; often `None` on consumer PCs.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gpu_temp_celsius: Option<f32>,
    /// DIMM / memory sensor (°C) when exposed; frequently `None` without vendor drivers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ram_temp_celsius: Option<f32>,
}

/// Result of discovering / opening a folder for Source Control.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitOpenResult {
    /// SCM folder the user opened (may be inside a repo).
    pub folder_path: String,
    /// Git worktree root when `is_repo`, otherwise the opened folder.
    pub root: String,
    pub is_repo: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    /// Short HEAD object id when born.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub head: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ahead: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub behind: Option<u32>,
}

/// Kind of change for a path in status lists.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitChangeStatus {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChange,
    Untracked,
    Conflict,
    IntentToAdd,
}

/// One path in staged / unstaged / untracked / conflict lists.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusEntry {
    /// Repository-relative path using `/` separators.
    pub path: String,
    pub absolute_path: String,
    pub status: GitChangeStatus,
}

/// Aggregated `git status`-style lists for the SCM panel.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub staged: Vec<GitStatusEntry>,
    pub unstaged: Vec<GitStatusEntry>,
    pub untracked: Vec<GitStatusEntry>,
    pub conflicted: Vec<GitStatusEntry>,
}

/// Local branch row for the branch menu.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchInfo {
    pub name: String,
    pub is_current: bool,
}

/// Result of creating a commit.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitResult {
    pub id: String,
}

fn default_agent_provider() -> String {
    "gemini".into()
}

fn default_gemini_model() -> String {
    "gemini-3.6-flash".into()
}

fn default_system_prompt() -> String {
    "You are GenSource Terminal's agent. Reply in the Agents chat panel. \
Use tools for files, git, and settings when helpful. \
Only use the terminal tool when the user asks you to run a shell command."
        .into()
}

/// Gemini (or future) provider credentials under `providers` in `agent.json`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentProviderConfig {
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "default_gemini_model")]
    pub model: String,
}

impl Default for AgentProviderConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: default_gemini_model(),
        }
    }
}

/// On-disk `other/configs/agent.json` — multi-provider-ready, Gemini-first.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    #[serde(default = "default_agent_provider")]
    pub active_provider: String,
    #[serde(default)]
    pub providers: std::collections::HashMap<String, AgentProviderConfig>,
    #[serde(default = "default_system_prompt")]
    pub system_prompt: String,
    /// Optional vault password for packaged/portable unlock. Never copy a
    /// `GENSOURCE_VAULT_PASSWORD` from `.env` here automatically.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub vault_password: String,
}

impl Default for AgentConfig {
    fn default() -> Self {
        let mut providers = std::collections::HashMap::new();
        providers.insert(
            "gemini".into(),
            AgentProviderConfig {
                api_key: String::new(),
                model: default_gemini_model(),
            },
        );
        Self {
            active_provider: default_agent_provider(),
            providers,
            system_prompt: default_system_prompt(),
            vault_password: String::new(),
        }
    }
}

impl AgentConfig {
    /// Active provider entry (creates a default gemini slot when missing).
    pub fn active(&self) -> AgentProviderConfig {
        self.providers
            .get(&self.active_provider)
            .cloned()
            .or_else(|| self.providers.get("gemini").cloned())
            .unwrap_or_default()
    }
}

/// Runtime-resolved portable data paths (no machine-specific literals in source).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableDataPaths {
    pub chats_db: String,
    pub vault_path: String,
    pub salt_path: String,
    pub vault_exists: bool,
}

/// Conversation row for the Agents Previous chats list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConversation {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Persisted chat bubble (UI + SQLite).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentStoredMessage {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_status: Option<String>,
    pub created_at: i64,
    pub sort_index: i64,
}

/// Args for creating a conversation (optional title).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConversationArgs {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

/// Args for renaming a conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameConversationArgs {
    pub id: String,
    pub title: String,
}

/// One-shot import of plugin-store chat bubbles (UI shape, no SQL ids required).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentLegacyMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_status: Option<String>,
}

/// One-shot import of plugin-store chat bubbles.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLegacyMessagesArgs {
    pub messages: Vec<AgentLegacyMessage>,
}

/// Cache the Gemini key in Rust after Stronghold unlock/create.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentCacheApiKeyArgs {
    pub api_key: String,
}

/// Dev-only secrets from gitignored `.env` files. Empty in packaged builds.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDevEnvSecrets {
    #[serde(default)]
    pub vault_password: String,
    #[serde(default)]
    pub gemini_api_key: String,
}

/// Frontend → Rust: start an agent turn.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentChatSendArgs {
    pub conversation_id: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recent_output: Option<String>,
}

/// Streamed assistant text chunk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentChunkEvent {
    pub conversation_id: String,
    pub text: String,
}

/// Tool call lifecycle event for the Agents panel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentToolEvent {
    pub conversation_id: String,
    pub name: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentDoneEvent {
    pub conversation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentErrorEvent {
    pub conversation_id: String,
    pub message: String,
}

/// Destructive tool needs UI confirmation before continuing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfirmEvent {
    pub conversation_id: String,
    pub request_id: String,
    pub tool: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfirmResponseArgs {
    pub request_id: String,
    pub approved: bool,
}
