import { afterEach, describe, expect } from "vitest";
import test from "vitest-gwt";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CONTAINER_HOME, CONTAINER_WORKSPACE } from "../base/constants.js";
import {
  CLAUDE_API_KEY_ENV,
  CLAUDE_CONTAINER_CREDENTIALS_PATH,
  CLAUDE_OAUTH_TOKEN_ENV,
} from "./constants.js";
import {
  buildClaudeDockerArgs,
  resolveClaudeCredentials,
  runClaudeInDocker,
  type ClaudeCredentials,
} from "./run.js";
import type { DockerRunOptions, DockerRunner } from "../types.js";

const SECRET = "sk-ant-oat01-super-secret";

type Context = {
  args: string[];
  result: unknown;
  credentials: ClaudeCredentials;
  resolved: ClaudeCredentials;
  dockerRunner: DockerRunner;
  lastArgs: string[];
  lastRunOptions: DockerRunOptions | undefined;
  hostEnv: NodeJS.ProcessEnv;
  home: string;
};

const envFlagValues = (args: string[]) => args.filter((arg, i) => args[i - 1] === "-e");
const volumeMounts = (args: string[]) => args.filter((arg, i) => args[i - 1] === "-v");

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("buildClaudeDockerArgs", () => {
  test("runs as host user with an OAuth token forwarded by name only", {
    given: {
      oauth_token_credentials,
    },
    when: {
      building_docker_args,
    },
    then: {
      uses_host_uid_gid,
      sets_container_home,
      mounts_workspace,
      forwards_oauth_token_env_by_name,
      secret_is_not_on_argv,
      does_not_mount_credentials_file,
      invokes_claude_headless_with_json_output,
    },
  });

  test("forwards an API key by name only", {
    given: {
      api_key_credentials,
    },
    when: {
      building_docker_args,
    },
    then: {
      forwards_api_key_env_by_name,
    },
  });

  test("mounts a credentials file read-only", {
    given: {
      credentials_file_credentials,
    },
    when: {
      building_docker_args,
    },
    then: {
      mounts_credentials_file_read_only,
      does_not_mount_dot_claude_directory,
      forwards_no_secret_env,
    },
  });

  test("includes --model when a model is provided", {
    given: {
      oauth_token_credentials,
    },
    when: {
      building_docker_args_with_model,
    },
    then: {
      includes_model_flag,
    },
  });
});

function oauth_token_credentials(this: Context) {
  this.credentials = { kind: "oauth-token", token: SECRET };
}

function api_key_credentials(this: Context) {
  this.credentials = { kind: "api-key", apiKey: SECRET };
}

function credentials_file_credentials(this: Context) {
  this.credentials = { kind: "credentials-file", file: "/home/dev/.claude/.credentials.json" };
}

function building_docker_args(this: Context) {
  this.args = buildClaudeDockerArgs({
    workspace: "/tmp/.agents-gwt/ws-abc",
    prompt: "Create a README",
    image: "agent-gwt/claude-code:local",
    credentials: this.credentials,
    uid: 1000,
    gid: 1000,
  });
}

function building_docker_args_with_model(this: Context) {
  this.args = buildClaudeDockerArgs({
    workspace: "/tmp/.agents-gwt/ws-abc",
    prompt: "Create a README",
    image: "agent-gwt/claude-code:local",
    credentials: this.credentials,
    uid: 1000,
    gid: 1000,
    model: "sonnet",
  });
}

function uses_host_uid_gid(this: Context) {
  expect(this.args).toContain("--user");
  expect(this.args[this.args.indexOf("--user") + 1]).toBe("1000:1000");
}

function sets_container_home(this: Context) {
  expect(envFlagValues(this.args)).toContain(`HOME=${CONTAINER_HOME}`);
}

function mounts_workspace(this: Context) {
  expect(this.args).toContain(`/tmp/.agents-gwt/ws-abc:${CONTAINER_WORKSPACE}`);
}

function forwards_oauth_token_env_by_name(this: Context) {
  const env = envFlagValues(this.args);
  expect(env).toContain(CLAUDE_OAUTH_TOKEN_ENV);
  expect(env).not.toContain(CLAUDE_API_KEY_ENV);
}

function forwards_api_key_env_by_name(this: Context) {
  const env = envFlagValues(this.args);
  expect(env).toContain(CLAUDE_API_KEY_ENV);
  expect(env).not.toContain(CLAUDE_OAUTH_TOKEN_ENV);
}

function forwards_no_secret_env(this: Context) {
  const env = envFlagValues(this.args);
  expect(env).not.toContain(CLAUDE_OAUTH_TOKEN_ENV);
  expect(env).not.toContain(CLAUDE_API_KEY_ENV);
}

function secret_is_not_on_argv(this: Context) {
  for (const arg of this.args) {
    expect(arg.includes(SECRET)).toBe(false);
  }
}

function does_not_mount_credentials_file(this: Context) {
  for (const mount of volumeMounts(this.args)) {
    expect(mount.includes(CLAUDE_CONTAINER_CREDENTIALS_PATH)).toBe(false);
  }
}

function mounts_credentials_file_read_only(this: Context) {
  expect(this.args).toContain(
    `/home/dev/.claude/.credentials.json:${CLAUDE_CONTAINER_CREDENTIALS_PATH}:ro`,
  );
}

function does_not_mount_dot_claude_directory(this: Context) {
  for (const mount of volumeMounts(this.args)) {
    expect(mount.includes("/.claude:")).toBe(false);
  }
}

function invokes_claude_headless_with_json_output(this: Context) {
  expect(this.args).toContain("claude");
  expect(this.args).toContain("-p");
  expect(this.args).toContain("--output-format");
  expect(this.args).toContain("json");
  expect(this.args).toContain("--dangerously-skip-permissions");
  expect(this.args.at(-2)).toBe("--");
  expect(this.args.at(-1)).toBe("Create a README");
}

function includes_model_flag(this: Context) {
  const modelIndex = this.args.indexOf("--model");
  expect(modelIndex).toBeGreaterThan(-1);
  expect(this.args[modelIndex + 1]).toBe("sonnet");
  expect(this.args.indexOf("--")).toBeGreaterThan(modelIndex);
}

describe("resolveClaudeCredentials", () => {
  test("prefers an OAuth token over an API key and a credentials file", {
    given: {
      home_with_credentials_file,
      host_env_with_token_and_api_key,
    },
    when: {
      resolving_credentials,
    },
    then: {
      resolves_oauth_token,
    },
  });

  test("falls back to an API key", {
    given: {
      home_with_credentials_file,
      host_env_with_api_key,
    },
    when: {
      resolving_credentials,
    },
    then: {
      resolves_api_key,
    },
  });

  test("falls back to a readable credentials file", {
    given: {
      home_with_credentials_file,
      empty_host_env,
    },
    when: {
      resolving_credentials,
    },
    then: {
      resolves_credentials_file,
    },
  });

  test("throws with guidance when nothing is configured", {
    given: {
      home_without_credentials_file,
      empty_host_env,
    },
    when: {
      resolving_credentials,
    },
    then: {
      expect_error: error_explains_how_to_authenticate,
    },
  });
});

async function home_with_credentials_file(this: Context) {
  this.home = await mkdtemp(join(tmpdir(), "agent-gwt-home-"));
  tempRoots.push(this.home);
  await mkdir(join(this.home, ".claude"), { recursive: true });
  await writeFile(join(this.home, ".claude", ".credentials.json"), "{}\n");
}

async function home_without_credentials_file(this: Context) {
  this.home = await mkdtemp(join(tmpdir(), "agent-gwt-home-"));
  tempRoots.push(this.home);
}

function host_env_with_token_and_api_key(this: Context) {
  this.hostEnv = { [CLAUDE_OAUTH_TOKEN_ENV]: SECRET, [CLAUDE_API_KEY_ENV]: "sk-ant-api" };
}

function host_env_with_api_key(this: Context) {
  this.hostEnv = { [CLAUDE_API_KEY_ENV]: "sk-ant-api" };
}

function empty_host_env(this: Context) {
  this.hostEnv = {};
}

async function resolving_credentials(this: Context) {
  this.resolved = await resolveClaudeCredentials({ env: this.hostEnv, home: this.home });
}

function resolves_oauth_token(this: Context) {
  expect(this.resolved).toEqual({ kind: "oauth-token", token: SECRET });
}

function resolves_api_key(this: Context) {
  expect(this.resolved).toEqual({ kind: "api-key", apiKey: "sk-ant-api" });
}

function resolves_credentials_file(this: Context) {
  expect(this.resolved).toEqual({
    kind: "credentials-file",
    file: join(this.home, ".claude", ".credentials.json"),
  });
}

function error_explains_how_to_authenticate(this: Context, error: Error) {
  expect(error.message).toContain("claude setup-token");
  expect(error.message).toContain(CLAUDE_OAUTH_TOKEN_ENV);
  expect(error.message).toContain(CLAUDE_API_KEY_ENV);
}

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

async function running_claude_in_docker(this: Context) {
  this.result = await runClaudeInDocker(
    {
      workspace: "/tmp/.agents-gwt/ws-abc",
      prompt: "hi",
      image: "agent-gwt/claude-code:local",
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
