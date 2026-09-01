import { describe, expect } from "vitest";
import test from "vitest-gwt";

import type { ClaudeCredentials } from "./_resolveCredentials.js";
import { CLAUDE_API_KEY_ENV, CLAUDE_OAUTH_TOKEN_ENV } from "./constants.js";
import { runClaudeInDocker } from "./run.js";
import type { DockerRunOptions, DockerRunner } from "../types.js";

const SECRET = "sk-ant-oat01-super-secret";

type Context = {
  result: unknown;
  credentials: ClaudeCredentials;
  dockerRunner: DockerRunner;
  lastArgs: string[];
  lastRunOptions: DockerRunOptions | undefined;
};

describe("runClaudeInDocker", () => {
  test("parses JSON from a successful run and hands the OAuth token to the docker CLI env", {
    given: {
      successful_docker_runner,
      oauth_token_credentials,
    },
    when: {
      running_claude_in_docker,
    },
    then: {
      agent_result_is_parsed,
      docker_runner_received_oauth_token_env,
      docker_runner_received_claude_args,
    },
  });

  test("hands an API key to the docker CLI env", {
    given: {
      successful_docker_runner,
      api_key_credentials,
    },
    when: {
      running_claude_in_docker,
    },
    then: {
      docker_runner_received_api_key_env,
    },
  });

  test("throws when docker exits non-zero", {
    given: {
      failing_docker_runner,
      oauth_token_credentials,
    },
    when: {
      running_claude_in_docker,
    },
    then: {
      expect_error: error_includes_exit_code,
    },
  });

  test("surfaces claude's reported message when docker exits non-zero with a JSON result", {
    given: {
      failing_docker_runner_with_error_result,
      oauth_token_credentials,
    },
    when: {
      running_claude_in_docker,
    },
    then: {
      expect_error: error_includes_exit_code_and_claude_message,
    },
  });

  test("throws when claude reports is_error in its result", {
    given: {
      error_result_docker_runner,
      oauth_token_credentials,
    },
    when: {
      running_claude_in_docker,
    },
    then: {
      expect_error: error_includes_claude_message,
    },
  });
});

function successful_docker_runner(this: Context) {
  this.dockerRunner = async (args, options) => {
    this.lastArgs = args;
    this.lastRunOptions = options;
    return {
      exitCode: 0,
      stdout: '{"type":"result","subtype":"success","is_error":false,"result":"done"}',
      stderr: "",
    };
  };
}

function failing_docker_runner(this: Context) {
  this.dockerRunner = async () => ({
    exitCode: 1,
    stdout: "",
    stderr: "boom",
  });
}

function failing_docker_runner_with_error_result(this: Context) {
  this.dockerRunner = async () => ({
    exitCode: 1,
    stdout:
      '{"type":"result","subtype":"success","is_error":true,"result":"Not logged in · Please run /login","terminal_reason":"api_error"}',
    stderr: "",
  });
}

function error_result_docker_runner(this: Context) {
  this.dockerRunner = async () => ({
    exitCode: 0,
    stdout:
      '{"type":"result","subtype":"error_during_execution","is_error":true,"result":"Invalid API key"}',
    stderr: "",
  });
}

function oauth_token_credentials(this: Context) {
  this.credentials = { kind: "oauth-token", token: SECRET };
}

function api_key_credentials(this: Context) {
  this.credentials = { kind: "api-key", apiKey: SECRET };
}

async function running_claude_in_docker(this: Context) {
  this.result = await runClaudeInDocker(
    {
      workspace: "/tmp/.agents-gwt/ws-abc",
      prompt: "hi",
      image: "clanker-cleanroom/claude",
      credentials: this.credentials,
      uid: 1000,
      gid: 1000,
    },
    this.dockerRunner,
  );
}

function agent_result_is_parsed(this: Context) {
  expect(this.result).toEqual({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "done",
  });
}

function docker_runner_received_oauth_token_env(this: Context) {
  expect(this.lastRunOptions?.env).toEqual({ [CLAUDE_OAUTH_TOKEN_ENV]: SECRET });
}

function docker_runner_received_api_key_env(this: Context) {
  expect(this.lastRunOptions?.env).toEqual({ [CLAUDE_API_KEY_ENV]: SECRET });
}

function docker_runner_received_claude_args(this: Context) {
  expect(this.lastArgs).toContain("claude");
  expect(this.lastArgs.at(-1)).toBe("hi");
}

function error_includes_exit_code(this: Context, error: Error) {
  expect(error.message).toContain("exited with code 1");
}

function error_includes_exit_code_and_claude_message(this: Context, error: Error) {
  expect(error.message).toContain("exited with code 1: api_error: Not logged in");
}

function error_includes_claude_message(this: Context, error: Error) {
  expect(error.message).toContain("Invalid API key");
  expect(error.message).toContain("error_during_execution");
}
