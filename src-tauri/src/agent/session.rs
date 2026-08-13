//! Agent chat session memory, cancel flags, and destructive-tool confirms.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rig::message::Message;
use tokio::sync::oneshot;
use uuid::Uuid;

/// Shared runtime state for Agents panel conversations.
#[derive(Default)]
pub struct AgentSessionStore {
    history: Mutex<HashMap<String, Vec<Message>>>,
    cancel: Mutex<HashMap<String, Arc<std::sync::atomic::AtomicBool>>>,
    confirms: Mutex<HashMap<String, oneshot::Sender<bool>>>,
}

impl AgentSessionStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn history(&self, conversation_id: &str) -> Vec<Message> {
        self.history
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .get(conversation_id)
            .cloned()
            .unwrap_or_default()
    }

    pub fn set_history(&self, conversation_id: &str, messages: Vec<Message>) {
        self.history
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .insert(conversation_id.to_string(), messages);
    }

    pub fn clear(&self, conversation_id: &str) {
        self.history
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .remove(conversation_id);
        if let Some(flag) = self
            .cancel
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .remove(conversation_id)
        {
            flag.store(true, std::sync::atomic::Ordering::SeqCst);
        }
    }

    pub fn begin_turn(&self, conversation_id: &str) -> Arc<std::sync::atomic::AtomicBool> {
        let flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
        self.cancel
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .insert(conversation_id.to_string(), Arc::clone(&flag));
        flag
    }

    pub fn cancel(&self, conversation_id: &str) {
        if let Some(flag) = self
            .cancel
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .get(conversation_id)
        {
            flag.store(true, std::sync::atomic::Ordering::SeqCst);
        }
    }

    pub fn end_turn(&self, conversation_id: &str) {
        self.cancel
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .remove(conversation_id);
    }

    /// Register a oneshot confirm and return its request id.
    pub fn register_confirm(&self) -> (String, oneshot::Receiver<bool>) {
        let id = Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        self.confirms
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .insert(id.clone(), tx);
        (id, rx)
    }

    pub fn resolve_confirm(&self, request_id: &str, approved: bool) -> bool {
        if let Some(tx) = self
            .confirms
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .remove(request_id)
        {
            let _ = tx.send(approved);
            true
        } else {
            false
        }
    }

    pub async fn wait_confirm(
        &self,
        rx: oneshot::Receiver<bool>,
        timeout: Duration,
    ) -> Result<bool, String> {
        match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(approved)) => Ok(approved),
            Ok(Err(_)) => Err("confirm channel closed".into()),
            Err(_) => Err("confirm timed out".into()),
        }
    }
}
