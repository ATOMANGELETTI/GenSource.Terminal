export interface AgentProviderConfig {
  apiKey: string;
  model: string;
}

export interface AgentConfig {
  activeProvider: string;
  providers: Record<string, AgentProviderConfig>;
  systemPrompt: string;
}

export interface AgentChatSendArgs {
  conversationId: string;
  message: string;
  sessionId?: string | null;
  cwd?: string | null;
  recentOutput?: string | null;
}

export interface AgentChunkEvent {
  conversationId: string;
  text: string;
}

export interface AgentToolEvent {
  conversationId: string;
  name: string;
  status: string;
  detail?: string | null;
}

export interface AgentDoneEvent {
  conversationId: string;
}

export interface AgentErrorEvent {
  conversationId: string;
  message: string;
}

export interface AgentConfirmEvent {
  conversationId: string;
  requestId: string;
  tool: string;
  summary: string;
}

export type AgentMessageRole = "user" | "assistant" | "tool";

export interface AgentChatMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  toolName?: string;
  toolStatus?: string;
}

export interface AgentTerminalContext {
  sessionId: string | null;
  cwd: string | null;
  /** Last N lines of active xterm scrollback. */
  getRecentOutput: (maxChars?: number) => string;
  /** Append a command (+ newline) to the active PTY. */
  writeCommand: (command: string) => void;
}
