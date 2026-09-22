import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { parseTrajectory, type Trajectory } from "clanker-cleanroom";

import { adaptCopilotEvents } from "./trajectory.js";

type Context = {
  trajectory?: Trajectory;
};

describe("adaptCopilotEvents", () => {
  test("normalizes a Copilot CLI JSONL stream with tool calls", {
    when: {
      parsing_copilot_fixture,
    },
    then: {
      copilot_session_and_messages,
      copilot_tool_calls,
      copilot_result,
    },
  });

  test("maps unknown event types to other", {
    when: {
      parsing_unknown_event,
    },
    then: {
      unknown_event_preserved,
    },
  });
});

function parsing_copilot_fixture(this: Context) {
  this.trajectory = parseTrajectory(
    [
      JSON.stringify({
        type: "session.start",
        data: { sessionId: "sess-copilot", selectedModel: "gpt-5" },
      }),
      JSON.stringify({ type: "assistant.message", data: { content: "Reading the repo" } }),
      JSON.stringify({
        type: "tool.execution_start",
        data: { toolCallId: "t1", toolName: "shell", arguments: { command: "ls" } },
      }),
      JSON.stringify({
        type: "tool.execution_complete",
        data: { toolCallId: "t1", toolName: "shell", success: true },
      }),
      JSON.stringify({
        type: "result",
        data: {
          sessionId: "sess-copilot",
          exitCode: 0,
          content: "Done",
          usage: { totalApiDurationMs: 900 },
        },
      }),
    ].join("\n"),
    "copilot",
    adaptCopilotEvents,
  );
}

function parsing_unknown_event(this: Context) {
  this.trajectory = parseTrajectory(
    JSON.stringify({ type: "session.shutdown", data: {} }),
    "copilot",
    adaptCopilotEvents,
  );
}

function copilot_session_and_messages(this: Context) {
  expect(this.trajectory?.provider).toBe("copilot");
  expect(this.trajectory?.sessionId()).toBe("sess-copilot");
  expect(this.trajectory?.assistantMessages()).toEqual(["Reading the repo"]);
}

function copilot_tool_calls(this: Context) {
  expect(this.trajectory?.toolCalls()).toEqual([
    {
      callId: "t1",
      name: "shell",
      args: { command: "ls" },
      result: { success: true },
    },
  ]);
}

function copilot_result(this: Context) {
  expect(this.trajectory?.result()).toEqual({
    kind: "result",
    text: "Done",
    isError: false,
    durationMs: 900,
    costUsd: null,
    raw: expect.objectContaining({ type: "result" }),
  });
}

function unknown_event_preserved(this: Context) {
  expect(this.trajectory?.result()).toBeNull();
}
