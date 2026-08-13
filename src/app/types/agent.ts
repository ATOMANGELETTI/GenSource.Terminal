export interface AgentProviderConfig {
  apiKey: string;
  model: string;
}

export interface AgentConfig {
  activeProvider: string;
  providers: Record<string, AgentProviderConfig>;
  systemPrompt: string;
  /** Optional packaged unlock password. Omit or empty to skip serializing. */
  vaultPassword?: string;
}

export interface AgentDevEnvSecrets {
  vaultPassword: string;
  geminiApiKey: string;
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

export type AgentMessageRole = "user" | "assistant" | "tool" | "confirm";

export type AgentConfirmDecision = "allowed" | "denied" | "expired";

export interface AgentChatMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  toolName?: string;
  toolStatus?: string;
  confirmRequestId?: string;
  confirmDecision?: AgentConfirmDecision;
}

export interface AgentConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentStoredMessage extends AgentChatMessage {
  conversationId: string;
  createdAt: number;
  sortIndex: number;
}

export interface PortableDataPaths {
  chatsDb: string;
  vaultPath: string;
  saltPath: string;
  vaultExists: boolean;
}

export interface AgentTerminalContext {
  sessionId: string | null;
  cwd: string | null;
  /** Last N lines of active xterm scrollback. */
  getRecentOutput: (maxChars?: number) => string;
  /** Append a command (+ newline) to the active PTY. */
  writeCommand: (command: string) => void;
}
