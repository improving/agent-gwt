import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { parseTrajectory, type Trajectory } from "clanker-cleanroom";

import { adaptCursorEvents } from "./trajectory.js";

type Context = {
  trajectory?: Trajectory;
};

describe("adaptCursorEvents", () => {
  test("normalizes a Cursor stream with tool calls", {
    when: {
      parsing_cursor_fixture,
    },
    then: {
      cursor_session_and_messages,
      cursor_tool_calls,
      cursor_result,
    },
  });
});

function parsing_cursor_fixture(this: Context) {
  this.trajectory = parseTrajectory(
    [
      JSON.stringify({
        type: "system",
        subtype: "init",
        session_id: "sess-cursor",
        model: "Composer",
      }),
      JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "text", text: "Read README" }] },
      }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "Reading" }] },
      }),
      JSON.stringify({
        type: "tool_call",
        subtype: "started",
        call_id: "c1",
        tool_call: { readToolCall: { args: { path: "README.md" } } },
      }),
      JSON.stringify({
        type: "tool_call",
        subtype: "completed",
        call_id: "c1",
        tool_call: {
          readToolCall: {
            args: { path: "README.md" },
            result: { success: { content: "# Hi" } },
          },
        },
      }),
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 100,
        result: "Done",
      }),
    ].join("\n"),
    "cursor",
    adaptCursorEvents,
  );
}

function cursor_session_and_messages(this: Context) {
  expect(this.trajectory?.provider).toBe("cursor");
  expect(this.trajectory?.sessionId()).toBe("sess-cursor");
  expect(this.trajectory?.assistantMessages()).toEqual(["Reading"]);
}

function cursor_tool_calls(this: Context) {
  expect(this.trajectory?.toolCalls()).toEqual([
    {
      callId: "c1",
      name: "readToolCall",
      args: { path: "README.md" },
      result: { success: { content: "# Hi" } },
    },
  ]);
}

function cursor_result(this: Context) {
  expect(this.trajectory?.result()).toEqual({
    kind: "result",
    text: "Done",
    isError: false,
    durationMs: 100,
    costUsd: null,
    raw: expect.objectContaining({ type: "result" }),
  });
}
