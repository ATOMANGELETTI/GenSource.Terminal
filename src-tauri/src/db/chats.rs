//! Chat CRUD against `other/database/sqlite/agents/chats/chats.db`.

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use rig::message::Message;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use sqlx::{Row, SqlitePool};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::config;
use crate::mdoels::{AgentConversation, AgentLegacyMessage, AgentStoredMessage};

const DEFAULT_TITLE: &str = "New chat";
const TITLE_MAX_CHARS: usize = 60;

/// Derive a conversation title from the first user message.
pub fn conversation_title_from_message(message: &str) -> String {
    let first_line = message
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");
    if first_line.is_empty() {
        return DEFAULT_TITLE.to_string();
    }
    let mut title: String = first_line.chars().take(TITLE_MAX_CHARS).collect();
    if first_line.chars().count() > TITLE_MAX_CHARS {
        title.push('…');
    }
    title
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Lazy sqlx pool for the portable chats database.
#[derive(Clone, Default)]
pub struct ChatDb {
    pool: Arc<Mutex<Option<SqlitePool>>>,
}

impl ChatDb {
    pub fn new() -> Self {
        Self::default()
    }

    async fn pool(&self) -> Result<SqlitePool, String> {
        let mut guard = self.pool.lock().await;
        if let Some(pool) = guard.as_ref() {
            return Ok(pool.clone());
        }
        let path = config::resolve_chats_db_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("create chats dir: {e}"))?;
        }
        let options = SqliteConnectOptions::new()
            .filename(&path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .foreign_keys(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .map_err(|e| format!("open chats.db: {e}"))?;
        migrate(&pool).await?;
        *guard = Some(pool.clone());
        Ok(pool)
    }

    pub async fn list_conversations(&self) -> Result<Vec<AgentConversation>, String> {
        let pool = self.pool().await?;
        let rows = sqlx::query(
            "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("list conversations: {e}"))?;
        Ok(rows
            .iter()
            .map(|row| AgentConversation {
                id: row.get("id"),
                title: row.get("title"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect())
    }

    pub async fn create_conversation(
        &self,
        title: Option<String>,
    ) -> Result<AgentConversation, String> {
        let pool = self.pool().await?;
        let id = Uuid::new_v4().to_string();
        let now = now_ms();
        let title = title
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| DEFAULT_TITLE.to_string());
        sqlx::query(
            "INSERT INTO conversations (id, title, created_at, updated_at, llm_history_json)
             VALUES (?, ?, ?, ?, NULL)",
        )
        .bind(&id)
        .bind(&title)
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .map_err(|e| format!("create conversation: {e}"))?;
        Ok(AgentConversation {
            id,
            title,
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn ensure_conversation(&self, id: &str) -> Result<(), String> {
        let pool = self.pool().await?;
        let now = now_ms();
        sqlx::query(
            "INSERT INTO conversations (id, title, created_at, updated_at, llm_history_json)
             VALUES (?, ?, ?, ?, NULL)
             ON CONFLICT(id) DO NOTHING",
        )
        .bind(id)
        .bind(DEFAULT_TITLE)
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .map_err(|e| format!("ensure conversation: {e}"))?;
        Ok(())
    }

    pub async fn rename_conversation(&self, id: &str, title: &str) -> Result<(), String> {
        if id.is_empty() {
            return Err("id is required".into());
        }
        let title = title.trim();
        if title.is_empty() {
            return Err("title is required".into());
        }
        let pool = self.pool().await?;
        let result = sqlx::query(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
        )
        .bind(title)
        .bind(now_ms())
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|e| format!("rename conversation: {e}"))?;
        if result.rows_affected() == 0 {
            return Err("conversation not found".into());
        }
        Ok(())
    }

    pub async fn delete_conversation(&self, id: &str) -> Result<(), String> {
        if id.is_empty() {
            return Err("id is required".into());
        }
        let pool = self.pool().await?;
        sqlx::query("DELETE FROM conversations WHERE id = ?")
            .bind(id)
            .execute(&pool)
            .await
            .map_err(|e| format!("delete conversation: {e}"))?;
        Ok(())
    }

    pub async fn clear_messages(&self, conversation_id: &str) -> Result<(), String> {
        let pool = self.pool().await?;
        sqlx::query("DELETE FROM messages WHERE conversation_id = ?")
            .bind(conversation_id)
            .execute(&pool)
            .await
            .map_err(|e| format!("clear messages: {e}"))?;
        sqlx::query(
            "UPDATE conversations SET llm_history_json = NULL, updated_at = ? WHERE id = ?",
        )
        .bind(now_ms())
        .bind(conversation_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("clear history: {e}"))?;
        Ok(())
    }

    pub async fn get_messages(
        &self,
        conversation_id: &str,
    ) -> Result<Vec<AgentStoredMessage>, String> {
        let pool = self.pool().await?;
        let rows = sqlx::query(
            "SELECT id, conversation_id, role, content, tool_name, tool_status, created_at, sort_index
             FROM messages WHERE conversation_id = ? ORDER BY sort_index ASC, created_at ASC",
        )
        .bind(conversation_id)
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("get messages: {e}"))?;
        Ok(rows
            .iter()
            .map(|row| AgentStoredMessage {
                id: row.get("id"),
                conversation_id: row.get("conversation_id"),
                role: row.get("role"),
                content: row.get("content"),
                tool_name: row.get("tool_name"),
                tool_status: row.get("tool_status"),
                created_at: row.get("created_at"),
                sort_index: row.get("sort_index"),
            })
            .collect())
    }

    pub async fn next_sort_index(&self, conversation_id: &str) -> Result<i64, String> {
        let pool = self.pool().await?;
        let row = sqlx::query(
            "SELECT COALESCE(MAX(sort_index), -1) AS n FROM messages WHERE conversation_id = ?",
        )
        .bind(conversation_id)
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("sort index: {e}"))?;
        Ok(row.get::<i64, _>("n") + 1)
    }

    pub async fn insert_message(
        &self,
        conversation_id: &str,
        role: &str,
        content: &str,
        tool_name: Option<&str>,
        tool_status: Option<&str>,
        id: Option<String>,
    ) -> Result<AgentStoredMessage, String> {
        self.ensure_conversation(conversation_id).await?;
        let pool = self.pool().await?;
        let id = id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = now_ms();
        let sort_index = self.next_sort_index(conversation_id).await?;
        sqlx::query(
            "INSERT INTO messages (id, conversation_id, role, content, tool_name, tool_status, created_at, sort_index)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(conversation_id)
        .bind(role)
        .bind(content)
        .bind(tool_name)
        .bind(tool_status)
        .bind(now)
        .bind(sort_index)
        .execute(&pool)
        .await
        .map_err(|e| format!("insert message: {e}"))?;
        sqlx::query("UPDATE conversations SET updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(conversation_id)
            .execute(&pool)
            .await
            .map_err(|e| format!("touch conversation: {e}"))?;
        Ok(AgentStoredMessage {
            id,
            conversation_id: conversation_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
            tool_name: tool_name.map(str::to_string),
            tool_status: tool_status.map(str::to_string),
            created_at: now,
            sort_index,
        })
    }

    pub async fn maybe_set_title_from_message(
        &self,
        conversation_id: &str,
        message: &str,
    ) -> Result<(), String> {
        let pool = self.pool().await?;
        let row = sqlx::query("SELECT title FROM conversations WHERE id = ?")
            .bind(conversation_id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| format!("read title: {e}"))?;
        let Some(row) = row else {
            return Ok(());
        };
        let current: String = row.get("title");
        if current != DEFAULT_TITLE {
            return Ok(());
        }
        let title = conversation_title_from_message(message);
        sqlx::query("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
            .bind(&title)
            .bind(now_ms())
            .bind(conversation_id)
            .execute(&pool)
            .await
            .map_err(|e| format!("set title: {e}"))?;
        Ok(())
    }

    pub async fn set_llm_history(
        &self,
        conversation_id: &str,
        history: &[Message],
    ) -> Result<(), String> {
        let json = serde_json::to_string(history).map_err(|e| format!("serialize history: {e}"))?;
        let pool = self.pool().await?;
        sqlx::query(
            "UPDATE conversations SET llm_history_json = ?, updated_at = ? WHERE id = ?",
        )
        .bind(&json)
        .bind(now_ms())
        .bind(conversation_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("save history: {e}"))?;
        Ok(())
    }

    pub async fn load_llm_history(
        &self,
        conversation_id: &str,
    ) -> Result<Option<Vec<Message>>, String> {
        let pool = self.pool().await?;
        let row = sqlx::query("SELECT llm_history_json FROM conversations WHERE id = ?")
            .bind(conversation_id)
            .fetch_optional(&pool)
            .await
            .map_err(|e| format!("load history: {e}"))?;
        let Some(row) = row else {
            return Ok(None);
        };
        let json: Option<String> = row.get("llm_history_json");
        let Some(json) = json.filter(|s| !s.trim().is_empty()) else {
            return Ok(None);
        };
        match serde_json::from_str(&json) {
            Ok(history) => Ok(Some(history)),
            Err(err) => {
                log::warn!("llm_history_json deserialize failed: {err}");
                Ok(None)
            }
        }
    }

    pub async fn import_legacy_messages(
        &self,
        messages: Vec<AgentLegacyMessage>,
    ) -> Result<AgentConversation, String> {
        if messages.is_empty() {
            return Err("no messages to import".into());
        }
        let title = messages
            .iter()
            .find(|m| m.role == "user")
            .map(|m| conversation_title_from_message(&m.content))
            .unwrap_or_else(|| DEFAULT_TITLE.to_string());
        let conversation = self.create_conversation(Some(title)).await?;
        for message in messages {
            let id = if message.id.trim().is_empty() {
                None
            } else {
                Some(message.id.clone())
            };
            self.insert_message(
                &conversation.id,
                &message.role,
                &message.content,
                message.tool_name.as_deref(),
                message.tool_status.as_deref(),
                id,
            )
            .await?;
        }
        Ok(conversation)
    }
}

async fn migrate(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            llm_history_json TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("migrate conversations: {e}"))?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            tool_name TEXT,
            tool_status TEXT,
            created_at INTEGER NOT NULL,
            sort_index INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("migrate messages: {e}"))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_messages_conversation_sort
         ON messages (conversation_id, sort_index)",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("migrate messages index: {e}"))?;

    Ok(())
}
