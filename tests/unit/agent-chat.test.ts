import { describe, expect, it } from "vitest";

import {
  appendConfirmMessage,
  applyAgentChunk,
  conversationTitleFromMessage,
  defaultAgentConfig,
  expirePendingConfirmMessages,
  formatRelativeTime,
  mergeAssistantReply,
  resolveConfirmMessage,
  stripAgentApiKeys,
} from "@/lib/agent";
import type { AgentChatMessage, AgentConfirmEvent } from "@/types";

function msg(
  id: string,
  role: AgentChatMessage["role"],
  content: string,
): AgentChatMessage {
  return { id, role, content };
}

function tool(id: string): AgentChatMessage {
  return {
    id,
    role: "tool",
    content: "ok",
    toolName: "fs_list",
    toolStatus: "ok",
  };
}

describe("mergeAssistantReply", () => {
  it("leaves history unchanged when the reply is blank", () => {
    const messages = [msg("u1", "user", "test")];
    expect(mergeAssistantReply(messages, "  ", null, () => "x")).toEqual(
      messages,
    );
  });

  it("appends an assistant bubble when streaming never arrived", () => {
    const messages = [msg("u1", "user", "test")];
    const next = mergeAssistantReply(messages, "Hi there", null, () => "a1");
    expect(next).toEqual([
      messages[0],
      msg("a1", "assistant", "Hi there"),
    ]);
  });

  it("fills the streamed assistant message from the command result", () => {
    const messages = [
      msg("u1", "user", "test"),
      msg("s1", "assistant", ""),
    ];
    const next = mergeAssistantReply(messages, "Done.", "s1", () => "nope");
    expect(next[1]).toEqual(msg("s1", "assistant", "Done."));
  });

  it("does not append when last message is already the same assistant reply", () => {
    const messages = [msg("u1", "user", "test"), msg("a1", "assistant", "Hi there")];
    expect(mergeAssistantReply(messages, "Hi there", null, () => "a2")).toEqual(
      messages,
    );
  });

  it("fills an earlier assistant when a tool chip is last", () => {
    const messages = [
      msg("u1", "user", "test"),
      msg("a1", "assistant", ""),
      tool("t1"),
    ];
    const next = mergeAssistantReply(messages, "Listed files", null, () => "a2");
    expect(next.filter((m) => m.role === "assistant")).toHaveLength(1);
    expect(next[1]).toEqual(msg("a1", "assistant", "Listed files"));
    expect(next[2]).toEqual(tool("t1"));
  });
});

describe("applyAgentChunk", () => {
  it("does not duplicate when a late chunk matches the merged reply", () => {
    const messages = [msg("u1", "user", "test"), msg("a1", "assistant", "Hi there")];
    const next = applyAgentChunk(messages, "Hi there", null, () => "a2");
    expect(next.messages).toEqual(messages);
    expect(next.streamingId).toBe("a1");
  });

  it("reuses an earlier assistant when a tool chip is last", () => {
    const messages = [
      msg("u1", "user", "test"),
      msg("a1", "assistant", "Hi"),
      tool("t1"),
    ];
    const next = applyAgentChunk(messages, " there", null, () => "a2");
    expect(next.messages.filter((m) => m.role === "assistant")).toHaveLength(1);
    expect(next.messages[1].content).toBe("Hi there");
    expect(next.streamingId).toBe("a1");
  });
});

describe("conversationTitleFromMessage", () => {
  it("uses the first non-empty line and truncates", () => {
    expect(conversationTitleFromMessage("Hello world")).toBe("Hello world");
    expect(conversationTitleFromMessage("  \nHi")).toBe("Hi");
    expect(conversationTitleFromMessage("")).toBe("New chat");
    const long = "a".repeat(80);
    const title = conversationTitleFromMessage(long);
    expect([...title].length).toBeLessThanOrEqual(61);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("formatRelativeTime", () => {
  it("formats recent timestamps", () => {
    const now = 1_700_000_000_000;
    expect(formatRelativeTime(now - 5_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 120_000, now)).toBe("2m ago");
    expect(formatRelativeTime(now - 3_600_000, now)).toBe("1h ago");
  });
});

const confirmEvent = (
  overrides: Partial<AgentConfirmEvent> = {},
): AgentConfirmEvent => ({
  conversationId: "conv-1",
  requestId: "req-1",
  tool: "terminal_write",
  summary: "echo hello",
  ...overrides,
});

describe("appendConfirmMessage", () => {
  it("appends a pending confirm card", () => {
    const messages = [msg("u1", "user", "run it")];
    const next = appendConfirmMessage(messages, confirmEvent(), () => "c1");
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(messages[0]);
    expect(next[1]).toEqual({
      id: "c1",
      role: "confirm",
      content: "echo hello",
      toolName: "terminal_write",
      confirmRequestId: "req-1",
    });
    expect(next[1].confirmDecision).toBeUndefined();
  });

  it("does not duplicate the same request id", () => {
    const first = appendConfirmMessage([], confirmEvent(), () => "c1");
    const next = appendConfirmMessage(first, confirmEvent(), () => "c2");
    expect(next).toBe(first);
  });
});

describe("resolveConfirmMessage", () => {
  it("updates the matching card in place", () => {
    const messages = appendConfirmMessage(
      [msg("u1", "user", "run it")],
      confirmEvent(),
      () => "c1",
    );
    const allowed = resolveConfirmMessage(messages, "req-1", "allowed");
    expect(allowed[0]).toEqual(messages[0]);
    expect(allowed[1]).toEqual({
      ...messages[1],
      confirmDecision: "allowed",
    });

    const denied = resolveConfirmMessage(messages, "req-1", "denied");
    expect(denied[1].confirmDecision).toBe("denied");
  });

  it("is a no-op when the request id is missing", () => {
    const messages = [msg("u1", "user", "hi")];
    expect(resolveConfirmMessage(messages, "missing", "allowed")).toBe(
      messages,
    );
  });
});

describe("expirePendingConfirmMessages", () => {
  it("marks pending confirm cards expired and leaves decided cards", () => {
    const pending = appendConfirmMessage([], confirmEvent(), () => "c1");
    const decided = resolveConfirmMessage(pending, "req-1", "allowed");
    const mixed = [
      ...decided,
      ...appendConfirmMessage([], confirmEvent({ requestId: "req-2" }), () => "c2"),
    ];
    const next = expirePendingConfirmMessages(mixed);
    expect(next[0].confirmDecision).toBe("allowed");
    expect(next[1].confirmDecision).toBe("expired");
  });
});

describe("stripAgentApiKeys", () => {
  it("clears provider api keys and keeps vaultPassword", () => {
    const config = defaultAgentConfig();
    config.providers.gemini.apiKey = "should-not-persist";
    config.vaultPassword = "portable";
    const next = stripAgentApiKeys(config);
    expect(next.providers.gemini.apiKey).toBe("");
    expect(next.vaultPassword).toBe("portable");
    expect(next.providers.gemini.model).toBe(config.providers.gemini.model);
  });
});
