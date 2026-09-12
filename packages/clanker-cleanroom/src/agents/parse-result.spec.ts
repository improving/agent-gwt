import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { parseAgentJsonOutput } from "./parse-result.js";

type Context = {
  stdout: string;
  result: unknown;
};

describe("parseAgentJsonOutput", () => {
  test("parses a single JSON result object", {
    given: {
      json_stdout,
    },
    when: {
      parsing_stdout,
    },
    then: {
      result_is_parsed_object,
    },
  });

  test("returns the terminal result event from NDJSON", {
    given: {
      ndjson_trajectory,
    },
    when: {
      parsing_stdout,
    },
    then: {
      result_is_terminal_event,
    },
  });

  test("rejects empty trajectory", {
    given: {
      empty_stdout,
    },
    when: {
      parsing_stdout,
    },
    then: {
      expect_error: error_mentions_empty_trajectory,
    },
  });

  test("rejects invalid JSON", {
    given: {
      invalid_json_stdout,
    },
    when: {
      parsing_stdout,
    },
    then: {
      expect_error: error_mentions_invalid_json,
    },
  });
});

function json_stdout(this: Context) {
  this.stdout = '  {"type":"result","result":"ok"}  \n';
}

function ndjson_trajectory(this: Context) {
  this.stdout = [
    JSON.stringify({ type: "system", subtype: "init" }),
    JSON.stringify({ type: "result", result: "done", duration_ms: 9 }),
  ].join("\n");
}

function empty_stdout(this: Context) {
  this.stdout = "   \n";
}

function invalid_json_stdout(this: Context) {
  this.stdout = "not-json";
}

function parsing_stdout(this: Context) {
  this.result = parseAgentJsonOutput(this.stdout);
}

function result_is_parsed_object(this: Context) {
  expect(this.result).toEqual({ type: "result", result: "ok" });
}

function result_is_terminal_event(this: Context) {
  expect(this.result).toEqual({ type: "result", result: "done", duration_ms: 9 });
}

function error_mentions_empty_trajectory(this: Context, error: Error) {
  expect(error.message).toContain("empty trajectory");
}

function error_mentions_invalid_json(this: Context, error: Error) {
  expect(error.message).toContain("not valid JSON");
}
