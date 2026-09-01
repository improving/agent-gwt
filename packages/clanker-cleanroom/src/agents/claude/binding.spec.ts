import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { claudeBinding } from "./binding.js";

type Context = {
  result?: ReturnType<typeof claudeBinding.parseResult>;
  error?: Error;
};

describe("claudeBinding.parseResult", () => {
  test("maps duration, cost, and usage tokens", {
    when: {
      parsing_claude_json,
    },
    then: {
      metrics_mapped,
    },
  });

  test("throws when is_error is true", {
    when: {
      parsing_error_json_catching,
    },
    then: {
      error_mentions_claude,
    },
  });
});

function parsing_claude_json(this: Context) {
  this.result = claudeBinding.parseResult(
    JSON.stringify({
      type: "result",
      is_error: false,
      duration_ms: 500,
      total_cost_usd: 0.0123,
      usage: {
        input_tokens: 11,
        output_tokens: 22,
        cache_read_input_tokens: 33,
        cache_creation_input_tokens: 44,
      },
      result: "ignored dialog",
    }),
  );
}

function parsing_error_json_catching(this: Context) {
  try {
    claudeBinding.parseResult(
      JSON.stringify({
        type: "result",
        is_error: true,
        subtype: "error",
        result: "Not logged in",
      }),
    );
  } catch (error) {
    this.error = error as Error;
  }
}

function metrics_mapped(this: Context) {
  expect(this.result).toEqual({
    durationMs: 500,
    costUsd: 0.0123,
    usage: {
      inputTokens: 11,
      outputTokens: 22,
      cacheReadTokens: 33,
      cacheWriteTokens: 44,
    },
  });
}

function error_mentions_claude(this: Context) {
  expect(this.error?.message).toContain("Claude agent reported an error");
  expect(this.error?.message).toContain("Not logged in");
}
