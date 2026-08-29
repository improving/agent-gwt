import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { join } from "node:path";

import {
  CONTAINER_AUTH_PATH,
  CONTAINER_HOME,
  CONTAINER_WORKSPACE,
} from "./constants.js";
import { buildDockerArgs, runCursorInDocker } from "./run.js";
import type { DockerRunner } from "../types.js";

type Context = {
  args: string[];
  result: unknown;
  dockerRunner: DockerRunner;
  authFile: string;
};

describe("buildDockerArgs", () => {
  test("runs as host user with credentials-only and workspace mounts", {
    when: {
      building_docker_args,
    },
    then: {
      uses_host_uid_gid,
      sets_container_home,
      mounts_workspace,
      mounts_auth_file_read_only,
      does_not_mount_dot_cursor_directory,
      invokes_agent_with_json_output,
    },
  });

  test("includes --model when a model is provided", {
    when: {
      building_docker_args_with_model,
    },
    then: {
      includes_model_flag,
    },
  });
});

function building_docker_args(this: Context) {
  this.args = buildDockerArgs({
    workspace: "/tmp/.agents-gwt/ws-abc",
    prompt: "Create a README",
    image: "agent-gwt/cursor-cli:local",
    authFile: "/home/dev/.config/cursor/auth.json",
    uid: 1000,
    gid: 1000,
  });
}

function building_docker_args_with_model(this: Context) {
  this.args = buildDockerArgs({
    workspace: "/tmp/.agents-gwt/ws-abc",
    prompt: "Create a README",
    image: "agent-gwt/cursor-cli:local",
    authFile: "/home/dev/.config/cursor/auth.json",
    uid: 1000,
    gid: 1000,
    model: "composer-2",
  });
}

function uses_host_uid_gid(this: Context) {
  expect(this.args).toContain("--user");
  expect(this.args[this.args.indexOf("--user") + 1]).toBe("1000:1000");
}

function sets_container_home(this: Context) {
  const homeFlagIndex = this.args.findIndex(
    (arg, i) => arg === "-e" && this.args[i + 1]?.startsWith("HOME="),
  );
  expect(this.args[homeFlagIndex + 1]).toBe(`HOME=${CONTAINER_HOME}`);
}

function mounts_workspace(this: Context) {
  expect(this.args).toContain(`/tmp/.agents-gwt/ws-abc:${CONTAINER_WORKSPACE}`);
}

function mounts_auth_file_read_only(this: Context) {
  expect(this.args).toContain(`/home/dev/.config/cursor/auth.json:${CONTAINER_AUTH_PATH}:ro`);
}

function does_not_mount_dot_cursor_directory(this: Context) {
  const volumeMounts = this.args.filter((arg, i) => this.args[i - 1] === "-v");
  for (const mount of volumeMounts) {
    expect(mount.includes("/.cursor:")).toBe(false);
  }
}

function invokes_agent_with_json_output(this: Context) {
  expect(this.args).toContain("agent");
  expect(this.args).toContain("--output-format");
  expect(this.args).toContain("json");
  expect(this.args).toContain("--force");
  expect(this.args.at(-1)).toBe("Create a README");
}

function includes_model_flag(this: Context) {
  const modelIndex = this.args.indexOf("--model");
  expect(modelIndex).toBeGreaterThan(-1);
  expect(this.args[modelIndex + 1]).toBe("composer-2");
  expect(this.args.indexOf("--")).toBeGreaterThan(modelIndex);
}

describe("runCursorInDocker", () => {
  test("parses JSON from a successful docker run", {
    given: {
      successful_docker_runner,
      existing_auth_file,
    },
    when: {
      running_cursor_in_docker,
    },
    then: {
      agent_result_is_parsed,
    },
  });

  test("throws when docker exits non-zero", {
    given: {
      failing_docker_runner,
      existing_auth_file,
    },
    when: {
      running_cursor_in_docker,
    },
    then: {
      expect_error: error_includes_exit_code,
    },
  });
});

function successful_docker_runner(this: Context) {
  this.dockerRunner = async () => ({
    exitCode: 0,
    stdout: '{"ok":true}',
    stderr: "",
  });
}

function failing_docker_runner(this: Context) {
  this.dockerRunner = async () => ({
    exitCode: 1,
    stdout: "",
    stderr: "boom",
  });
}

function existing_auth_file(this: Context) {
  this.authFile = join(process.cwd(), "package.json");
}

async function running_cursor_in_docker(this: Context) {
  this.result = await runCursorInDocker(
    {
      workspace: "/tmp/.agents-gwt/ws-abc",
      prompt: "hi",
      image: "agent-gwt/cursor-cli:local",
      authFile: this.authFile,
      uid: 1000,
      gid: 1000,
    },
    this.dockerRunner,
  );
}

function agent_result_is_parsed(this: Context) {
  expect(this.result).toEqual({ ok: true });
}

function error_includes_exit_code(this: Context, error: Error) {
  expect(error.message).toContain("exited with code 1");
}
