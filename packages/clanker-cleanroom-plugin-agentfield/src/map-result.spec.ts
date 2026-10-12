import type { Trajectory } from "clanker-cleanroom";
import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { mapRunToHarnessResult } from "./map-result.js";

type Context = {
  result?: ReturnType<typeof mapRunToHarnessResult>;
};

describe("mapRunToHarnessResult", () => {
  test("maps tokens, cost, session, and turns from trajectory", {
    when: {
      mapping_a_successful_run,
    },
    then: {
      harness_fields_populated,
    },
  });
});

function mapping_a_successful_run(this: Context) {
  const trajectory = {
    provider: "claude",
    events: [
      { kind: "assistant", text: "working", raw: {} },
      {
        kind: "tool",
        phase: "completed",
        callId: "1",
        name: "Bash",
        args: {},
        result: "ok",
        raw: {},
      },
      { kind: "assistant", text: "done", raw: {} },
      {
        kind: "result",
        text: "done",
        isError: false,
        durationMs: 200,
        costUsd: 1.5,
        raw: {},
      },
    ],
    sessionId: () => "abc",
    result: () => ({
      kind: "result" as const,
      text: "done",
      isError: false,
      durationMs: 200,
      costUsd: 1.5,
      raw: {},
    }),
    assistantMessages: () => ["working", "done"],
    toolCalls: () => [],
  } satisfies Trajectory;

  this.result = mapRunToHarnessResult({
    run: {
      durationMs: 200,
      costUsd: 1.5,
      usage: {
        inputTokens: 3,
        outputTokens: 4,
        cacheReadTokens: 1,
        cacheWriteTokens: 2,
      },
    },
    trajectory,
    sessionId: "abc",
  });
}

function harness_fields_populated(this: Context) {
  expect(this.result?.text).toBe("done");
  expect(this.result?.costUsd).toBe(1.5);
  expect(this.result?.inputTokens).toBe(3);
  expect(this.result?.outputTokens).toBe(4);
  expect(this.result?.cacheReadTokens).toBe(1);
  expect(this.result?.cacheCreationTokens).toBe(2);
  expect(this.result?.totalTokens).toBe(7);
  expect(this.result?.sessionId).toBe("abc");
  expect(this.result?.numTurns).toBe(3);
  expect(this.result?.messages.length).toBe(4);
}
