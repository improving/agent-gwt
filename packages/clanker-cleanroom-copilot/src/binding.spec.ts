import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { copilotBinding } from "./binding.js";

type Context = {
  result?: ReturnType<typeof copilotBinding.parseResult>;
};

describe("copilotBinding.parseResult", () => {
  test("maps duration from the result envelope; token usage is null", {
    when: {
      parsing_copilot_jsonl,
    },
    then: {
      metrics_mapped,
    },
  });

  test("throws when the result event reports a non-zero exit code", {
    when: {
      parsing_failed_result,
    },
    then: {
      expect_error: error_mentions_message,
    },
  });
});

function parsing_copilot_jsonl(this: Context) {
  this.result = copilotBinding.parseResult(
    [
      JSON.stringify({
        type: "session.start",
        data: { sessionId: "sess-copilot", selectedModel: "gpt-5" },
      }),
      JSON.stringify({ type: "assistant.message", data: { content: "Working" } }),
      JSON.stringify({
        type: "result",
        data: {
          sessionId: "sess-copilot",
          exitCode: 0,
          content: "Done",
          usage: { totalApiDurationMs: 2400 },
        },
      }),
    ].join("\n"),
  );
}

function parsing_failed_result(this: Context) {
  copilotBinding.parseResult(
    JSON.stringify({
      type: "result",
      data: { exitCode: 1, content: "permission denied" },
    }),
  );
}

function metrics_mapped(this: Context) {
  expect(this.result).toEqual({
    durationMs: 2400,
    costUsd: null,
    usage: {
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    },
  });
}

function error_mentions_message(this: Context, error: Error) {
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toContain("permission denied");
}
