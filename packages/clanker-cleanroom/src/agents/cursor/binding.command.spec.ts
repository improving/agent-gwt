import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { CONTAINER_HOME, CONTAINER_WORKSPACE } from "../base/constants.js";
import { buildDockerRunArgs } from "../docker.js";
import { cursorBinding } from "./binding.js";
import { CONTAINER_AUTH_PATH } from "./constants.js";

type Context = {
  args: string[];
};

describe("cursorBinding.command", () => {
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
  this.args = dockerArgs();
}

function building_docker_args_with_model(this: Context) {
  this.args = dockerArgs({ model: "composer-2" });
}

function dockerArgs(options: { model?: string } = {}): string[] {
  return buildDockerRunArgs({
    image: "clanker-cleanroom/cursor",
    uid: 1000,
    gid: 1000,
    workdir: CONTAINER_WORKSPACE,
    env: { HOME: CONTAINER_HOME },
    volumes: [
      { host: "/tmp/.agents-gwt/ws-abc", container: CONTAINER_WORKSPACE },
      {
        host: "/home/dev/.config/cursor/auth.json",
        container: CONTAINER_AUTH_PATH,
        mode: "ro",
      },
    ],
    command: cursorBinding.command({
      prompt: "Create a README",
      ...(options.model !== undefined ? { model: options.model } : {}),
    }),
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
