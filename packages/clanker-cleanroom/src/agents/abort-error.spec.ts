import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { AgentAbortError, isAbortError, tryParseAbortedResult } from "./abort-error.js";
import type { AgentRunResult } from "./types.js";

type Context = {
  result?: AgentRunResult;
  error?: Error;
  parsed?: AgentRunResult;
};

describe("AgentAbortError", () => {
  test("is detectable as AbortError and carries result", {
    when: {
      constructing_abort_error,
    },
    then: {
      name_is_abort_error,
      is_abort_error_true,
      result_is_attached,
    },
  });
});

describe("tryParseAbortedResult", () => {
  test("returns parseResult when trajectory is complete", {
    when: {
      parsing_complete_trajectory,
    },
    then: {
      parsed_from_binding,
    },
  });

  test("falls back to wall-clock duration when parseResult throws", {
    when: {
      parsing_empty_trajectory,
    },
    then: {
      fallback_has_duration_and_null_usage,
    },
  });
});

function constructing_abort_error(this: Context) {
  this.result = {
    durationMs: 10,
    costUsd: 0.02,
    usage: {
      inputTokens: 3,
      outputTokens: 4,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    },
  };
  this.error = new AgentAbortError(this.result);
}

function name_is_abort_error(this: Context) {
  expect(this.error?.name).toBe("AbortError");
}

function is_abort_error_true(this: Context) {
  expect(isAbortError(this.error)).toBe(true);
}

function result_is_attached(this: Context) {
  expect(this.error).toBeInstanceOf(AgentAbortError);
  expect((this.error as AgentAbortError).result).toEqual(this.result);
}

function parsing_complete_trajectory(this: Context) {
  this.parsed = tryParseAbortedResult(
    () => ({
      durationMs: 99,
      costUsd: 1,
      usage: {
        inputTokens: 1,
        outputTokens: 2,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      },
    }),
    '{"type":"result"}',
    Date.now() - 50,
  );
}

function parsed_from_binding(this: Context) {
  expect(this.parsed?.durationMs).toBe(99);
  expect(this.parsed?.costUsd).toBe(1);
}

function parsing_empty_trajectory(this: Context) {
  const startedAt = Date.now() - 25;
  this.parsed = tryParseAbortedResult(
    () => {
      throw new Error("no result");
    },
    "",
    startedAt,
  );
}

function fallback_has_duration_and_null_usage(this: Context) {
  expect(this.parsed?.durationMs).toBeGreaterThanOrEqual(25);
  expect(this.parsed?.costUsd).toBeNull();
  expect(this.parsed?.usage).toEqual({
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheWriteTokens: null,
  });
}
