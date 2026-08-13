import { describe, expect, it } from "vitest";

import { applyAgentChunk, mergeAssistantReply } from "@/lib/agent";
import type { AgentChatMessage } from "@/types";

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
