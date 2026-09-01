import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { cursorBinding } from "./binding.js";

type Context = {
  result?: ReturnType<typeof cursorBinding.parseResult>;
  error?: Error;
};

describe("cursorBinding.parseResult", () => {
  test("maps duration and usage tokens; costUsd is null", {
    when: {
      parsing_cursor_json,
    },
    then: {
      metrics_mapped,
    },
  });

  test("nulls missing usage fields", {
    when: {
      parsing_minimal_json,
    },
    then: {
      usage_fields_null,
    },
  });
});

function parsing_cursor_json(this: Context) {
  this.result = cursorBinding.parseResult(
    JSON.stringify({
      type: "result",
      duration_ms: 1200,
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        cacheReadTokens: 30,
        cacheWriteTokens: 40,
      },
      result: "ignored dialog",
    }),
  );
}

function parsing_minimal_json(this: Context) {
  this.result = cursorBinding.parseResult(JSON.stringify({ type: "result", result: "hi" }));
}

function metrics_mapped(this: Context) {
  expect(this.result).toEqual({
    durationMs: 1200,
    costUsd: null,
    usage: {
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 30,
      cacheWriteTokens: 40,
    },
  });
}

function usage_fields_null(this: Context) {
  expect(this.result).toEqual({
    durationMs: null,
    costUsd: null,
    usage: {
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    },
  });
}
