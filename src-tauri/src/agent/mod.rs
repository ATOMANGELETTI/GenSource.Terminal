//! Gemini agent loop owned by Rust (rig). Frontend is chat UI only.

mod session;
mod tools;

pub use session::AgentSessionStore;
pub use tools::AgentToolHost;

use std::sync::Arc;
use std::sync::atomic::Ordering;

use futures::StreamExt;
use rig::client::AgentClientExt;
use rig::message::Message;
use rig::providers::gemini;
use rig::streaming::StreamedAssistantContent;
use rig::tool::ToolContext;
use tauri::{AppHandle, Emitter, State};

use crate::agent::tools::{
    FsListTool, FsReadTool, FsWriteTool, GetSettingsTool, GitDiffSummaryTool, GitStatusTool,
    OpenPathTool, PatchSettingsTool, RevealPathTool, TerminalReadRecentTool, TerminalWriteTool,
};
use crate::config;
use crate::mdoels::{
    AgentChatSendArgs, AgentChunkEvent, AgentConfig, AgentConfirmResponseArgs, AgentDoneEvent,
    AgentErrorEvent,
};
use crate::pty::PtySessionPool;
use crate::state::AppState;

pub const AGENT_CHUNK_EVENT: &str = "agent-chunk";
pub const AGENT_DONE_EVENT: &str = "agent-done";
pub const AGENT_ERROR_EVENT: &str = "agent-error";

/// Non-editable chat-vs-terminal routing rules appended to every Gemini preamble.
const CHAT_VS_TERMINAL_POLICY: &str = "\n\n## Chat vs terminal (required)\n\
- Answer in the Agents chat UI. Never use the terminal as a reply channel.\n\
- Call `terminal_write` only when the user clearly asks to run a shell command or do something in the terminal.\n\
- Do not echo explanations, markdown, or chat answers via `terminal_write`.\n";

#[tauri::command]
pub fn get_agent_config(app: AppHandle, state: State<'_, AppState>) -> AgentConfig {
    let configs_dir = state
        .configs_dir
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
        .unwrap_or_else(|| config::resolve_configs_dir(&app));
    config::load_agent(&configs_dir)
}

#[tauri::command]
pub fn save_agent_config(app: AppHandle, config: AgentConfig) -> Result<AgentConfig, String> {
    config::save_and_emit_agent(&app, config)
}

#[tauri::command]
pub fn agent_chat_clear(
    sessions: State<'_, Arc<AgentSessionStore>>,
    conversation_id: String,
) -> Result<(), String> {
    sessions.clear(conversation_id.trim());
    Ok(())
}

#[tauri::command]
pub fn agent_chat_cancel(
    sessions: State<'_, Arc<AgentSessionStore>>,
    conversation_id: String,
) -> Result<(), String> {
    sessions.cancel(conversation_id.trim());
    Ok(())
}

#[tauri::command]
pub fn agent_confirm_response(
    sessions: State<'_, Arc<AgentSessionStore>>,
    args: AgentConfirmResponseArgs,
) -> Result<(), String> {
    if sessions.resolve_confirm(&args.request_id, args.approved) {
        Ok(())
    } else {
        Err("unknown confirm request".into())
    }
}

#[tauri::command]
pub async fn agent_chat_send(
    app: AppHandle,
    pool: State<'_, Arc<PtySessionPool>>,
    state: State<'_, AppState>,
    sessions: State<'_, Arc<AgentSessionStore>>,
    args: AgentChatSendArgs,
) -> Result<String, String> {
    let conversation_id = args.conversation_id.trim().to_string();
    let message = args.message.trim().to_string();
    if conversation_id.is_empty() {
        return Err("conversationId is required".into());
    }
    if message.is_empty() {
        return Err("message is required".into());
    }

    let configs_dir = state
        .configs_dir
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
        .unwrap_or_else(|| config::resolve_configs_dir(&app));
    let agent_cfg = config::load_agent(&configs_dir);
    let provider = agent_cfg.active();
    let api_key = provider.api_key.trim().to_string();
    if api_key.is_empty() {
        return Err(
            "Gemini API key missing. Set it in Config → Agents or other/configs/agent.json.".into(),
        );
    }
    if agent_cfg.active_provider != "gemini"
        && !agent_cfg
            .active_provider
            .eq_ignore_ascii_case("gemini")
    {
        return Err(format!(
            "Provider '{}' is not implemented yet; use gemini.",
            agent_cfg.active_provider
        ));
    }

    let model_name = if provider.model.trim().is_empty() {
        "gemini-3.6-flash".to_string()
    } else {
        provider.model.trim().to_string()
    };

    let cancel = sessions.begin_turn(&conversation_id);
    let mut history = sessions.history(&conversation_id);

    let host = AgentToolHost {
        app: app.clone(),
        conversation_id: conversation_id.clone(),
        session_id: args.session_id.clone(),
        cwd: args.cwd.clone(),
        recent_output: args.recent_output.clone(),
        pool: pool.inner().clone(),
        sessions: sessions.inner().clone(),
    };

    let mut tool_context = ToolContext::new();
    tool_context.insert(host);

    let client = gemini::Client::new(&api_key).map_err(|e| format!("gemini client: {e}"))?;

    let mut preamble = agent_cfg.system_prompt.clone();
    if let Some(cwd) = args.cwd.as_deref().filter(|s| !s.trim().is_empty()) {
        preamble.push_str(&format!("\nActive terminal cwd: {cwd}"));
    }
    if let Some(sid) = args.session_id.as_deref().filter(|s| !s.trim().is_empty()) {
        preamble.push_str(&format!("\nActive PTY session id: {sid}"));
    }
    // Fixed routing policy — always appended so custom systemPrompt cannot remove it.
    preamble.push_str(CHAT_VS_TERMINAL_POLICY);

    let agent = client
        .agent(&model_name)
        .preamble(&preamble)
        .tool(TerminalWriteTool)
        .tool(TerminalReadRecentTool)
        .tool(FsListTool)
        .tool(FsReadTool)
        .tool(FsWriteTool)
        .tool(GitStatusTool)
        .tool(GitDiffSummaryTool)
        .tool(GetSettingsTool)
        .tool(PatchSettingsTool)
        .tool(OpenPathTool)
        .tool(RevealPathTool)
        .default_max_turns(12)
        .build();

    let result = run_stream(
        &app,
        &conversation_id,
        &message,
        &mut history,
        &agent,
        tool_context,
        Arc::clone(&cancel),
    )
    .await;

    sessions.end_turn(&conversation_id);

    match result {
        Ok(reply) => {
            sessions.set_history(&conversation_id, history);
            let _ = app.emit(
                AGENT_DONE_EVENT,
                AgentDoneEvent {
                    conversation_id: conversation_id.clone(),
                },
            );
            Ok(reply)
        }
        Err(err) => {
            let message = err;
            let _ = app.emit(
                AGENT_ERROR_EVENT,
                AgentErrorEvent {
                    conversation_id: conversation_id.clone(),
                    message: message.clone(),
                },
            );
            Err(message)
        }
    }
}

/// Visible chat text for a finished agent turn.
/// Prefers streamed assistant text, then the final prompt output, then Gemini
/// thought parts (thinking models often mark the only tokens as thoughts).
pub(crate) fn visible_agent_reply(streamed: &str, final_output: &str, reasoning: &str) -> String {
    let streamed = streamed.trim();
    if !streamed.is_empty() {
        return streamed.to_string();
    }
    let final_output = final_output.trim();
    if !final_output.is_empty() {
        return final_output.to_string();
    }
    reasoning.trim().to_string()
}

fn emit_agent_chunk(app: &AppHandle, conversation_id: &str, text: String) {
    if text.is_empty() {
        return;
    }
    let _ = app.emit(
        AGENT_CHUNK_EVENT,
        AgentChunkEvent {
            conversation_id: conversation_id.to_string(),
            text,
        },
    );
}

async fn run_stream<M>(
    app: &AppHandle,
    conversation_id: &str,
    prompt: &str,
    history: &mut Vec<Message>,
    agent: &rig::agent::Agent<M>,
    tool_context: ToolContext,
    cancel: Arc<std::sync::atomic::AtomicBool>,
) -> Result<String, String>
where
    M: rig::completion::CompletionModel + 'static,
    <M as rig::completion::CompletionModel>::StreamingResponse: Send + Unpin,
{
    use rig::agent::MultiTurnStreamItem;
    use rig::completion::message::Text;
    use rig::streaming::StreamingChat;

    let mut stream = agent
        .stream_chat(prompt, history.clone())
        .tool_context(tool_context)
        .max_turns(12)
        .await;

    let mut acc = String::new();
    let mut reasoning = String::new();
    let mut final_output = String::new();
    let mut next_history: Option<Vec<Message>> = None;

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::SeqCst) {
            return Err("cancelled".into());
        }

        match chunk {
            Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Text(
                Text { text, .. },
            ))) => {
                if !text.is_empty() {
                    acc.push_str(&text);
                    emit_agent_chunk(app, conversation_id, text);
                }
            }
            Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Reasoning(
                block,
            ))) => {
                let text = block.display_text();
                if !text.is_empty() {
                    if !reasoning.is_empty() {
                        reasoning.push('\n');
                    }
                    reasoning.push_str(&text);
                }
            }
            Ok(MultiTurnStreamItem::StreamAssistantItem(
                StreamedAssistantContent::ReasoningDelta { reasoning: delta, .. },
            )) => {
                reasoning.push_str(&delta);
            }
            Ok(MultiTurnStreamItem::FinalResponse(final_response)) => {
                if !final_response.output.trim().is_empty() {
                    final_output = final_response.output.clone();
                }
                if let Some(msgs) = final_response.messages() {
                    next_history = Some(msgs.to_vec());
                }
            }
            Ok(_) => {}
            Err(err) => {
                return Err(err.to_string());
            }
        }
    }

    let visible = visible_agent_reply(&acc, &final_output, &reasoning);
    if acc.trim().is_empty() && !visible.is_empty() {
        log::info!(
            "agent reply had no text deltas; returning {} chars from final/reasoning",
            visible.len()
        );
    } else if visible.is_empty() {
        log::warn!("agent turn finished with no visible text");
    }

    if let Some(msgs) = next_history {
        history.extend(msgs);
    } else if !visible.is_empty() {
        history.push(Message::user(prompt));
        history.push(Message::assistant(visible.clone()));
    }

    Ok(visible)
}

/// Convenience: whether agent.json has a usable key (for UI empty state).
#[tauri::command]
pub fn agent_has_api_key(app: AppHandle, state: State<'_, AppState>) -> bool {
    let configs_dir = state
        .configs_dir
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone()
        .unwrap_or_else(|| config::resolve_configs_dir(&app));
    config::load_agent(&configs_dir).has_api_key()
}

#[cfg(test)]
mod tests {
    use super::visible_agent_reply;

    #[test]
    fn prefers_streamed_text_over_final_and_reasoning() {
        assert_eq!(
            visible_agent_reply("Hello", "ignored", "thoughts"),
            "Hello"
        );
    }

    #[test]
    fn uses_final_output_when_stream_was_empty() {
        assert_eq!(
            visible_agent_reply("", "Final answer", "thoughts"),
            "Final answer"
        );
    }

    #[test]
    fn uses_reasoning_when_gemini_only_emits_thoughts() {
        assert_eq!(
            visible_agent_reply("  ", "", "The user said test."),
            "The user said test."
        );
    }

    #[test]
    fn empty_when_the_model_returned_nothing_visible() {
        assert_eq!(visible_agent_reply("", "  ", "\n"), "");
    }
}