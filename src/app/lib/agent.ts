import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AgentChatMessage,
  AgentChatSendArgs,
  AgentChunkEvent,
  AgentConfig,
  AgentConfirmEvent,
  AgentConversation,
  AgentDoneEvent,
  AgentErrorEvent,
  AgentMessageRole,
  AgentProviderConfig,
  AgentStoredMessage,
  AgentToolEvent,
  PortableDataPaths,
} from "../types";

export const AGENT_CHUNK_EVENT = "agent-chunk";
export const AGENT_TOOL_EVENT = "agent-tool";
export const AGENT_DONE_EVENT = "agent-done";
export const AGENT_ERROR_EVENT = "agent-error";
export const AGENT_CONFIRM_EVENT = "agent-confirm";
export const AGENT_CHANGED_EVENT = "agent-changed";

const CHAT_STORE_KEY = "agent.chat.messages";
const TITLE_MAX_CHARS = 60;

export function conversationTitleFromMessage(message: string): string {
  const firstLine =
    message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  if (!firstLine) return "New chat";
  if ([...firstLine].length <= TITLE_MAX_CHARS) return firstLine;
  return `${[...firstLine].slice(0, TITLE_MAX_CHARS).join("")}…`;
}

export function formatRelativeTime(epochMs: number, now = Date.now()): string {
  const delta = Math.max(0, now - epochMs);
  const sec = Math.round(delta / 1000);
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m ago`;
  if (sec < 86400) return `${Math.max(1, Math.round(sec / 3600))}h ago`;
  if (sec < 604800) return `${Math.max(1, Math.round(sec / 86400))}d ago`;
  return new Date(epochMs).toLocaleDateString();
}

export function storedMessageToChat(
  row: AgentStoredMessage,
): AgentChatMessage {
  const role: AgentMessageRole =
    row.role === "user" || row.role === "assistant" || row.role === "tool"
      ? row.role
      : "assistant";
  return {
    id: row.id,
    role,
    content: row.content,
    toolName: row.toolName,
    toolStatus: row.toolStatus,
  };
}

export function defaultAgentConfig(): AgentConfig {
  return {
    activeProvider: "gemini",
    providers: {
      gemini: {
        apiKey: "",
        model: "gemini-3.6-flash",
      },
    },
    systemPrompt:
      "You are GenSource Terminal's agent. Prefer tools for shell, files, git, and settings.",
  };
}

export function activeProvider(
  config: AgentConfig,
): AgentProviderConfig {
  return (
    config.providers[config.activeProvider] ??
    config.providers.gemini ?? {
      apiKey: "",
      model: "gemini-3.6-flash",
    }
  );
}

export async function fetchAgentConfig(): Promise<AgentConfig> {
  return invoke<AgentConfig>("get_agent_config");
}

export async function saveAgentConfig(
  config: AgentConfig,
): Promise<AgentConfig> {
  return invoke<AgentConfig>("save_agent_config", { config });
}

export async function agentHasApiKey(): Promise<boolean> {
  return invoke<boolean>("agent_has_api_key");
}

export function lastAssistantIndex(messages: AgentChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "assistant") return i;
  }
  return -1;
}

export function mergeAssistantReply(
  messages: AgentChatMessage[],
  reply: string,
  streamingId: string | null,
  createId: () => string,
): AgentChatMessage[] {
  const text = reply.trim();
  if (!text) return messages;

  const streamedIdx = streamingId
    ? messages.findIndex((message) => message.id === streamingId)
    : -1;
  const target = streamedIdx >= 0 ? streamedIdx : lastAssistantIndex(messages);

  if (target >= 0) {
    if (messages[target].content === text) return messages;
    return messages.map((message, index) =>
      index === target ? { ...message, content: text } : message,
    );
  }

  return [
    ...messages,
    { id: createId(), role: "assistant", content: text },
  ];
}

export function applyAgentChunk(
  messages: AgentChatMessage[],
  text: string,
  streamingId: string | null,
  createId: () => string,
): { messages: AgentChatMessage[]; streamingId: string | null } {
  if (!text) return { messages, streamingId };

  const streamedIdx = streamingId
    ? messages.findIndex((message) => message.id === streamingId)
    : -1;
  const target = streamedIdx >= 0 ? streamedIdx : lastAssistantIndex(messages);

  if (target >= 0) {
    const current = messages[target].content ?? "";
    const nextContent =
      current === text || current.startsWith(text)
        ? current
        : text.startsWith(current)
          ? text
          : current + text;
    return {
      messages:
        nextContent === current
          ? messages
          : messages.map((message, index) =>
              index === target ? { ...message, content: nextContent } : message,
            ),
      streamingId: messages[target].id,
    };
  }

  const nextId = createId();
  return {
    messages: [
      ...messages,
      { id: nextId, role: "assistant", content: text },
    ],
    streamingId: nextId,
  };
}

export async function agentChatSend(
  args: AgentChatSendArgs,
): Promise<string> {
  return invoke<string>("agent_chat_send", { args });
}

export async function agentChatCancel(
  conversationId: string,
): Promise<void> {
  await invoke("agent_chat_cancel", { conversationId });
}

export async function agentChatClear(
  conversationId: string,
): Promise<void> {
  await invoke("agent_chat_clear", { conversationId });
}

export async function agentConfirmResponse(
  requestId: string,
  approved: boolean,
): Promise<void> {
  await invoke("agent_confirm_response", {
    args: { requestId, approved },
  });
}

export async function subscribeAgentChunk(
  handler: (event: AgentChunkEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentChunkEvent>(AGENT_CHUNK_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function subscribeAgentTool(
  handler: (event: AgentToolEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentToolEvent>(AGENT_TOOL_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function subscribeAgentDone(
  handler: (event: AgentDoneEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentDoneEvent>(AGENT_DONE_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function subscribeAgentError(
  handler: (event: AgentErrorEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentErrorEvent>(AGENT_ERROR_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function subscribeAgentConfirm(
  handler: (event: AgentConfirmEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentConfirmEvent>(AGENT_CONFIRM_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function subscribeAgentConfigChanges(
  handler: (config: AgentConfig) => void,
): Promise<UnlistenFn> {
  return listen<AgentConfig>(AGENT_CHANGED_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function getPortableDataPaths(): Promise<PortableDataPaths> {
  return invoke<PortableDataPaths>("get_portable_data_paths");
}

export async function listConversations(): Promise<AgentConversation[]> {
  return invoke<AgentConversation[]>("list_conversations");
}

export async function createConversation(
  title?: string,
): Promise<AgentConversation> {
  return invoke<AgentConversation>("create_conversation", {
    args: { title: title ?? null },
  });
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<void> {
  await invoke("rename_conversation", { args: { id, title } });
}

export async function deleteConversation(id: string): Promise<void> {
  await invoke("delete_conversation", { id });
}

export async function getConversationMessages(
  conversationId: string,
): Promise<AgentChatMessage[]> {
  const rows = await invoke<AgentStoredMessage[]>("get_conversation_messages", {
    conversationId,
  });
  return rows.map(storedMessageToChat);
}

export async function agentChatLoad(conversationId: string): Promise<void> {
  await invoke("agent_chat_load", { conversationId });
}

export async function importLegacyMessages(
  messages: AgentChatMessage[],
): Promise<AgentConversation> {
  return invoke<AgentConversation>("import_legacy_messages", {
    args: { messages },
  });
}

export async function agentCacheApiKey(apiKey: string): Promise<void> {
  await invoke("agent_cache_api_key", { args: { apiKey } });
}

export { CHAT_STORE_KEY };
