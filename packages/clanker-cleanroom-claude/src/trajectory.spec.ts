import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { parseTrajectory, type Trajectory } from "clanker-cleanroom";

import { adaptClaudeEvents } from "./trajectory.js";

type Context = {
  trajectory?: Trajectory;
};

describe("adaptClaudeEvents", () => {
  test("normalizes a Claude stream expanding tool_use and tool_result", {
    when: {
      parsing_claude_fixture,
    },
    then: {
      claude_assistant_and_tools,
      claude_result,
    },
  });
});

function parsing_claude_fixture(this: Context) {
  this.trajectory = parseTrajectory(
    [
      JSON.stringify({
        type: "system",
        subtype: "init",
        session_id: "sess-claude",
        model: "claude-sonnet",
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Using bash" },
            { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } },
          ],
        },
      }),
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "t1", content: "a.txt" }],
        },
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 50,
        total_cost_usd: 0.02,
        result: "Listed",
      }),
    ].join("\n"),
    "claude",
    adaptClaudeEvents,
  );
}

function claude_assistant_and_tools(this: Context) {
  expect(this.trajectory?.provider).toBe("claude");
  expect(this.trajectory?.sessionId()).toBe("sess-claude");
  expect(this.trajectory?.assistantMessages()).toEqual(["Using bash"]);
  expect(this.trajectory?.toolCalls()).toEqual([
    {
      callId: "t1",
      name: "Bash",
      args: { command: "ls" },
      result: "a.txt",
    },
  ]);
}

function claude_result(this: Context) {
  expect(this.trajectory?.result()).toEqual({
    kind: "result",
    text: "Listed",
    isError: false,
    durationMs: 50,
    costUsd: 0.02,
    raw: expect.objectContaining({ type: "result" }),
  });
}
