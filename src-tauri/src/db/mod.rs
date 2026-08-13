//! Portable SQLite (sqlx) for agent chats under `other/database/sqlite/`.

mod chats;

pub use chats::ChatDb;

use std::sync::Arc;

use tauri::State;

use crate::agent::AgentSessionStore;
use crate::config;
use crate::mdoels::{
    AgentConversation, AgentStoredMessage, CreateConversationArgs, ImportLegacyMessagesArgs,
    PortableDataPaths, RenameConversationArgs,
};

#[tauri::command]
pub fn get_portable_data_paths() -> PortableDataPaths {
    let vault = config::resolve_stronghold_vault_path();
    PortableDataPaths {
        chats_db: config::path_to_portable_string(&config::resolve_chats_db_path()),
        vault_path: config::path_to_portable_string(&vault),
        salt_path: config::path_to_portable_string(&config::resolve_stronghold_salt_path()),
        vault_exists: vault.is_file(),
    }
}

#[tauri::command]
pub async fn list_conversations(db: State<'_, ChatDb>) -> Result<Vec<AgentConversation>, String> {
    db.list_conversations().await
}

#[tauri::command]
pub async fn create_conversation(
    db: State<'_, ChatDb>,
    args: CreateConversationArgs,
) -> Result<AgentConversation, String> {
    let title = args
        .title
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty());
    db.create_conversation(title).await
}

#[tauri::command]
pub async fn rename_conversation(
    db: State<'_, ChatDb>,
    args: RenameConversationArgs,
) -> Result<(), String> {
    db.rename_conversation(args.id.trim(), args.title.trim())
        .await
}

#[tauri::command]
pub async fn delete_conversation(
    db: State<'_, ChatDb>,
    sessions: State<'_, Arc<AgentSessionStore>>,
    id: String,
) -> Result<(), String> {
    let id = id.trim();
    sessions.clear(id);
    db.delete_conversation(id).await
}

#[tauri::command]
pub async fn get_conversation_messages(
    db: State<'_, ChatDb>,
    conversation_id: String,
) -> Result<Vec<AgentStoredMessage>, String> {
    db.get_messages(conversation_id.trim()).await
}

#[tauri::command]
pub async fn agent_chat_load(
    db: State<'_, ChatDb>,
    sessions: State<'_, Arc<AgentSessionStore>>,
    conversation_id: String,
) -> Result<(), String> {
    let conversation_id = conversation_id.trim();
    if conversation_id.is_empty() {
        return Err("conversationId is required".into());
    }
    match db.load_llm_history(conversation_id).await? {
        Some(history) => sessions.set_history(conversation_id, history),
        None => sessions.set_history(conversation_id, Vec::new()),
    }
    Ok(())
}

#[tauri::command]
pub async fn import_legacy_messages(
    db: State<'_, ChatDb>,
    args: ImportLegacyMessagesArgs,
) -> Result<AgentConversation, String> {
    db.import_legacy_messages(args.messages).await
}

#[cfg(test)]
mod tests {
    use super::chats::conversation_title_from_message;

    #[test]
    fn title_from_first_line_truncated() {
        assert_eq!(conversation_title_from_message("Hello world"), "Hello world");
        assert_eq!(conversation_title_from_message("  \nHi"), "Hi");
        assert_eq!(conversation_title_from_message(""), "New chat");
        let long = "a".repeat(80);
        let title = conversation_title_from_message(&long);
        assert!(title.chars().count() <= 61);
        assert!(title.ends_with('…'));
    }
}
