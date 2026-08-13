//! Rig tools bridging PTY, filesystem, git, and settings.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use rig::tool::{Tool, ToolContext};
use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use thiserror::Error;

use crate::agent::session::AgentSessionStore;
use crate::config;
use crate::git;
use crate::mdoels::{AgentConfirmEvent, AgentToolEvent, AppSettings};
use crate::pty::PtySessionPool;
use crate::state::AppState;

pub const AGENT_TOOL_EVENT: &str = "agent-tool";
pub const AGENT_CONFIRM_EVENT: &str = "agent-confirm";

const MAX_READ_BYTES: u64 = 200_000;
const CONFIRM_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Clone)]
pub struct AgentToolHost {
    pub app: AppHandle,
    pub conversation_id: String,
    pub session_id: Option<String>,
    #[allow(dead_code)]
    pub cwd: Option<String>,
    pub recent_output: Option<String>,
    pub pool: Arc<PtySessionPool>,
    pub sessions: Arc<AgentSessionStore>,
}

#[derive(Debug, Error)]
#[error("{0}")]
pub struct ToolErr(pub String);

fn emit_tool(host: &AgentToolHost, name: &str, status: &str, detail: Option<String>) {
    let _ = host.app.emit(
        AGENT_TOOL_EVENT,
        AgentToolEvent {
            conversation_id: host.conversation_id.clone(),
            name: name.into(),
            status: status.into(),
            detail,
        },
    );
}

async fn require_confirm(host: &AgentToolHost, tool: &str, summary: &str) -> Result<(), ToolErr> {
    let (request_id, rx) = host.sessions.register_confirm();
    let _ = host.app.emit(
        AGENT_CONFIRM_EVENT,
        AgentConfirmEvent {
            conversation_id: host.conversation_id.clone(),
            request_id,
            tool: tool.into(),
            summary: summary.into(),
        },
    );
    let approved = host
        .sessions
        .wait_confirm(rx, CONFIRM_TIMEOUT)
        .await
        .map_err(ToolErr)?;
    if approved {
        Ok(())
    } else {
        Err(ToolErr("User declined the action".into()))
    }
}

fn host_from(ctx: &ToolContext) -> Result<AgentToolHost, ToolErr> {
    ctx.get::<AgentToolHost>()
        .cloned()
        .ok_or_else(|| ToolErr("missing agent tool host".into()))
}

// --- terminal_write ---

#[derive(Deserialize)]
pub struct TerminalWriteArgs {
    pub command: String,
    #[serde(default)]
    pub session_id: Option<String>,
}

pub struct TerminalWriteTool;

impl Tool for TerminalWriteTool {
    const NAME: &'static str = "terminal_write";
    type Args = TerminalWriteArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Run a shell command in the active (or specified) terminal PTY. \
Requires user Allow/Deny confirmation. Use only when the user asks to run a command \
or interact with the terminal — never for chat replies, explanations, or markdown."
            .into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "command": { "type": "string", "description": "Shell command to run" },
                "session_id": { "type": "string", "description": "Optional PTY session id" }
            },
            "required": ["command"]
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        let summary = {
            const MAX: usize = 120;
            let cmd = args.command.trim();
            let shown = if cmd.chars().count() > MAX {
                let truncated: String = cmd.chars().take(MAX).collect();
                format!("{truncated}…")
            } else {
                cmd.to_string()
            };
            format!("Run in terminal: {shown}")
        };
        emit_tool(&host, Self::NAME, "pending", Some(summary.clone()));
        require_confirm(&host, Self::NAME, &summary).await?;
        emit_tool(&host, Self::NAME, "running", Some(args.command.clone()));
        let sid = args
            .session_id
            .or(host.session_id.clone())
            .ok_or_else(|| ToolErr("No terminal session available".into()))?;
        let mut data = args.command;
        if !data.ends_with('\n') {
            data.push('\n');
        }
        host.pool
            .write(&sid, &data)
            .map_err(|e| ToolErr(e))?;
        emit_tool(&host, Self::NAME, "done", Some(format!("wrote to {sid}")));
        Ok(format!("Sent to terminal session {sid}"))
    }
}

// --- terminal_read_recent ---

#[derive(Deserialize)]
pub struct TerminalReadArgs {
    #[serde(default)]
    pub max_chars: Option<usize>,
}

pub struct TerminalReadRecentTool;

impl Tool for TerminalReadRecentTool {
    const NAME: &'static str = "terminal_read_recent";
    type Args = TerminalReadArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Return recent terminal scrollback supplied by the UI for this turn.".into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "max_chars": { "type": "integer", "description": "Optional truncate length" }
            }
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        emit_tool(&host, Self::NAME, "running", None);
        let mut text = host
            .recent_output
            .clone()
            .unwrap_or_else(|| "(no recent terminal output in context)".into());
        if let Some(max) = args.max_chars {
            if text.len() > max {
                text = text[text.len() - max..].to_string();
            }
        }
        emit_tool(&host, Self::NAME, "done", Some(format!("{} chars", text.len())));
        Ok(text)
    }
}

// --- fs_list ---

#[derive(Deserialize)]
pub struct FsListArgs {
    pub path: String,
}

pub struct FsListTool;

impl Tool for FsListTool {
    const NAME: &'static str = "fs_list";
    type Args = FsListArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "List files and directories at a path.".into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "path": { "type": "string" }
            },
            "required": ["path"]
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        emit_tool(&host, Self::NAME, "running", Some(args.path.clone()));
        let entries = crate::commands::fs_list_dir(args.path).map_err(ToolErr)?;
        let lines: Vec<String> = entries
            .into_iter()
            .map(|e| {
                let kind = match e.kind {
                    crate::mdoels::FsEntryKind::Dir => "dir",
                    crate::mdoels::FsEntryKind::File => "file",
                    crate::mdoels::FsEntryKind::Drive => "drive",
                };
                format!("{kind}\t{}\t{}", e.name, e.path)
            })
            .collect();
        let out = lines.join("\n");
        emit_tool(&host, Self::NAME, "done", Some(format!("{} entries", lines.len())));
        Ok(out)
    }
}

// --- fs_read ---

#[derive(Deserialize)]
pub struct FsReadArgs {
    pub path: String,
}

pub struct FsReadTool;

impl Tool for FsReadTool {
    const NAME: &'static str = "fs_read";
    type Args = FsReadArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Read a text file (truncated if large).".into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "path": { "type": "string" }
            },
            "required": ["path"]
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        emit_tool(&host, Self::NAME, "running", Some(args.path.clone()));
        let text = read_text_file(&args.path).map_err(ToolErr)?;
        emit_tool(&host, Self::NAME, "done", Some(format!("{} chars", text.len())));
        Ok(text)
    }
}

pub fn read_text_file(path: &str) -> Result<String, String> {
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err("path is required".into());
    }
    let meta = fs::metadata(&path).map_err(|e| format!("stat {}: {e}", path.display()))?;
    if !meta.is_file() {
        return Err(format!("{} is not a file", path.display()));
    }
    if meta.len() > MAX_READ_BYTES {
        let bytes = fs::read(&path).map_err(|e| format!("read {}: {e}", path.display()))?;
        let take = MAX_READ_BYTES as usize;
        let slice = &bytes[..take.min(bytes.len())];
        let mut text = String::from_utf8_lossy(slice).into_owned();
        text.push_str("\n\n… truncated …");
        return Ok(text);
    }
    fs::read_to_string(&path).map_err(|e| format!("read {}: {e}", path.display()))
}

// --- fs_write (destructive confirm) ---

#[derive(Deserialize)]
pub struct FsWriteArgs {
    pub path: String,
    pub contents: String,
}

pub struct FsWriteTool;

impl Tool for FsWriteTool {
    const NAME: &'static str = "fs_write";
    type Args = FsWriteArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Write text to a file (creates or overwrites). Requires user confirmation.".into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "path": { "type": "string" },
                "contents": { "type": "string" }
            },
            "required": ["path", "contents"]
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        emit_tool(&host, Self::NAME, "pending", Some(args.path.clone()));
        require_confirm(
            &host,
            Self::NAME,
            &format!("Write {} bytes to {}", args.contents.len(), args.path),
        )
        .await?;
        emit_tool(&host, Self::NAME, "running", Some(args.path.clone()));
        if let Some(parent) = PathBuf::from(&args.path).parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent)
                    .map_err(|e| ToolErr(format!("create parent: {e}")))?;
            }
        }
        fs::write(&args.path, args.contents.as_bytes())
            .map_err(|e| ToolErr(format!("write {}: {e}", args.path)))?;
        emit_tool(&host, Self::NAME, "done", Some(args.path.clone()));
        Ok(format!("Wrote {}", args.path))
    }
}

// --- git_status ---

#[derive(Deserialize)]
pub struct GitPathArgs {
    pub path: String,
}

pub struct GitStatusTool;

impl Tool for GitStatusTool {
    const NAME: &'static str = "git_status";
    type Args = GitPathArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Show git status (staged/unstaged/untracked/conflicted) for a repo path.".into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Repo root or path inside the repo" }
            },
            "required": ["path"]
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        emit_tool(&host, Self::NAME, "running", Some(args.path.clone()));
        let status = git::status(args.path.trim()).map_err(ToolErr)?;
        let mut lines = Vec::new();
        for (label, list) in [
            ("staged", &status.staged),
            ("unstaged", &status.unstaged),
            ("untracked", &status.untracked),
            ("conflicted", &status.conflicted),
        ] {
            for entry in list {
                lines.push(format!("{label}\t{:?}\t{}", entry.status, entry.path));
            }
        }
        if lines.is_empty() {
            lines.push("clean working tree".into());
        }
        let out = lines.join("\n");
        emit_tool(&host, Self::NAME, "done", None);
        Ok(out)
    }
}

// --- git_diff_summary ---

pub struct GitDiffSummaryTool;

impl Tool for GitDiffSummaryTool {
    const NAME: &'static str = "git_diff_summary";
    type Args = GitPathArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Summarize counts of git changes for a repo path.".into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "path": { "type": "string" }
            },
            "required": ["path"]
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        emit_tool(&host, Self::NAME, "running", Some(args.path.clone()));
        let status = git::status(args.path.trim()).map_err(ToolErr)?;
        let out = format!(
            "staged={} unstaged={} untracked={} conflicted={}",
            status.staged.len(),
            status.unstaged.len(),
            status.untracked.len(),
            status.conflicted.len()
        );
        emit_tool(&host, Self::NAME, "done", Some(out.clone()));
        Ok(out)
    }
}

// --- get_settings ---

#[derive(Deserialize)]
pub struct EmptyArgs {}

pub struct GetSettingsTool;

impl Tool for GetSettingsTool {
    const NAME: &'static str = "get_settings";
    type Args = EmptyArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Return current app settings.json values as JSON.".into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({ "type": "object", "properties": {} })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        _args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        emit_tool(&host, Self::NAME, "running", None);
        let state = host.app.state::<AppState>();
        let settings = state
            .settings
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();
        let out = serde_json::to_string_pretty(&settings)
            .map_err(|e| ToolErr(e.to_string()))?;
        emit_tool(&host, Self::NAME, "done", None);
        Ok(out)
    }
}

// --- patch_settings ---

#[derive(Deserialize)]
pub struct PatchSettingsArgs {
    pub patch: serde_json::Value,
}

const ALLOWED_PATCH_KEYS: &[&str] = &[
    "theme",
    "fontFamily",
    "fontSize",
    "particleEffect",
    "fileIconSet",
    "cursorStyle",
    "cursorBlink",
    "scrollbackLines",
    "terminalFontFamily",
    "terminalFontSize",
    "defaultProfile",
];

pub struct PatchSettingsTool;

impl Tool for PatchSettingsTool {
    const NAME: &'static str = "patch_settings";
    type Args = PatchSettingsArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Patch allowlisted settings.json keys (theme, fonts, particles, cursor, etc.). Requires confirmation."
            .into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "patch": {
                    "type": "object",
                    "description": "Partial settings object (camelCase keys)"
                }
            },
            "required": ["patch"]
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        let obj = args
            .patch
            .as_object()
            .ok_or_else(|| ToolErr("patch must be an object".into()))?;
        for key in obj.keys() {
            if !ALLOWED_PATCH_KEYS.contains(&key.as_str()) {
                return Err(ToolErr(format!("key '{key}' is not allowlisted")));
            }
        }
        let summary = format!("Apply settings patch: {}", args.patch);
        emit_tool(&host, Self::NAME, "pending", Some(summary.clone()));
        require_confirm(&host, Self::NAME, &summary).await?;
        emit_tool(&host, Self::NAME, "running", None);

        let state = host.app.state::<AppState>();
        let mut settings = state
            .settings
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();
        let mut current = serde_json::to_value(&settings).map_err(|e| ToolErr(e.to_string()))?;
        if let (Some(cur), Some(patch)) = (current.as_object_mut(), args.patch.as_object()) {
            for (k, v) in patch {
                cur.insert(k.clone(), v.clone());
            }
        }
        settings = serde_json::from_value::<AppSettings>(current)
            .map_err(|e| ToolErr(format!("invalid settings after patch: {e}")))?;
        config::save_and_apply_settings(&host.app, settings).map_err(ToolErr)?;
        emit_tool(&host, Self::NAME, "done", None);
        Ok("settings updated".into())
    }
}

// --- open_path / reveal_path ---

#[derive(Deserialize)]
pub struct PathArgs {
    pub path: String,
}

pub struct OpenPathTool;

impl Tool for OpenPathTool {
    const NAME: &'static str = "open_path";
    type Args = PathArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Open a file or folder with the OS default app.".into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": { "path": { "type": "string" } },
            "required": ["path"]
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        emit_tool(&host, Self::NAME, "running", Some(args.path.clone()));
        crate::commands::fs_open_path(args.path.clone()).map_err(ToolErr)?;
        emit_tool(&host, Self::NAME, "done", None);
        Ok(format!("opened {}", args.path))
    }
}

pub struct RevealPathTool;

impl Tool for RevealPathTool {
    const NAME: &'static str = "reveal_path";
    type Args = PathArgs;
    type Output = String;
    type Error = ToolErr;

    fn description(&self) -> String {
        "Reveal a path in the system file manager.".into()
    }

    fn parameters(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": { "path": { "type": "string" } },
            "required": ["path"]
        })
    }

    async fn call(
        &self,
        context: &mut ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let host = host_from(context)?;
        emit_tool(&host, Self::NAME, "running", Some(args.path.clone()));
        crate::commands::fs_reveal_path(args.path.clone()).map_err(ToolErr)?;
        emit_tool(&host, Self::NAME, "done", None);
        Ok(format!("revealed {}", args.path))
    }
}
