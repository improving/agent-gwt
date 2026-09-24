import { describe, expect } from "vitest";
import test from "vitest-gwt";

import {
  buildDockerRunArgs,
  CONTAINER_HOME,
  CONTAINER_WORKSPACE,
  type DockerVolumeMount,
} from "clanker-cleanroom";

import { claudeBinding } from "./binding.js";
import type { ClaudeCredentials } from "./credentials.js";
import { credentialsEnv } from "./credentials.js";
import {
  CLAUDE_API_KEY_ENV,
  CLAUDE_CONTAINER_CREDENTIALS_PATH,
  CLAUDE_OAUTH_TOKEN_ENV,
} from "./constants.js";

const SECRET = "sk-ant-oat01-super-secret";

type Context = {
  args: string[];
  credentials: ClaudeCredentials;
};

const envFlagValues = (args: string[]) => args.filter((arg, i) => args[i - 1] === "-e");
const volumeMounts = (args: string[]) => args.filter((arg, i) => args[i - 1] === "-v");

describe("claudeBinding.command", () => {
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

  test("includes --resume when a session id is provided", {
    given: {
      oauth_token_credentials,
    },
    when: {
      building_docker_args_with_session,
    },
    then: {
      includes_resume_flag,
    },
  });

  test("omits the raw prompt from argv so the CLI reads it from stdin", {
    when: {
      building_claude_command,
    },
    then: {
      command_omits_raw_prompt,
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
  this.args = dockerArgs(this.credentials);
}

function building_docker_args_with_model(this: Context) {
  this.args = dockerArgs(this.credentials, { model: "sonnet" });
}

function building_docker_args_with_session(this: Context) {
  this.args = dockerArgs(this.credentials, { sessionId: "sess-claude-1" });
}

function building_claude_command(this: Context) {
  this.args = claudeBinding.command({ prompt: "Create a README" });
}

function dockerArgs(
  credentials: ClaudeCredentials,
  options: { model?: string; sessionId?: string } = {},
): string[] {
  const volumes: DockerVolumeMount[] = [
    { host: "/tmp/.agents-gwt/ws-abc", container: CONTAINER_WORKSPACE },
  ];
  if (credentials.kind === "credentials-file") {
    volumes.push({
      host: credentials.file,
      container: CLAUDE_CONTAINER_CREDENTIALS_PATH,
      mode: "ro",
    });
  }

  return buildDockerRunArgs({
    image: "clanker-cleanroom/claude",
    uid: 1000,
    gid: 1000,
    workdir: CONTAINER_WORKSPACE,
    env: { HOME: CONTAINER_HOME },
    envPassthrough: Object.keys(credentialsEnv(credentials)),
    volumes,
    command: claudeBinding.command({
      prompt: "Create a README",
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
    }),
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
  expect(this.args).toContain("stream-json");
  expect(this.args).toContain("--verbose");
  expect(this.args).toContain("--dangerously-skip-permissions");
  expect(this.args.includes("Create a README")).toBe(false);
}

function command_omits_raw_prompt(this: Context) {
  expect(this.args.includes("Create a README")).toBe(false);
  expect(this.args.at(-1)).not.toBe("--");
}

function includes_model_flag(this: Context) {
  const modelIndex = this.args.indexOf("--model");
  expect(modelIndex).toBeGreaterThan(-1);
  expect(this.args[modelIndex + 1]).toBe("sonnet");
}

function includes_resume_flag(this: Context) {
  const resumeIndex = this.args.indexOf("--resume");
  expect(resumeIndex).toBeGreaterThan(-1);
  expect(this.args[resumeIndex + 1]).toBe("sess-claude-1");
}
