import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { parseAgentJsonOutput } from "./parse-result.js";

type Context = {
  stdout: string;
  result: unknown;
};

describe("parseAgentJsonOutput", () => {
  test("parses JSON stdout", {
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

  test("rejects empty stdout", {
    given: {
      empty_stdout,
    },
    when: {
      parsing_stdout,
    },
    then: {
      expect_error: error_mentions_empty_stdout,
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

function error_mentions_empty_stdout(this: Context, error: Error) {
  expect(error.message).toContain("empty stdout");
}

function error_mentions_invalid_json(this: Context, error: Error) {
  expect(error.message).toContain("not valid JSON");
}
