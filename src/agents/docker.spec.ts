import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { buildDockerRunArgs } from "./docker.js";

type Context = {
  args: string[];
};

describe("buildDockerRunArgs", () => {
  test("builds a docker run command with user, env, volumes, and workdir", {
    when: {
      building_args,
    },
    then: {
      uses_host_uid_gid,
      sets_env,
      mounts_volumes,
      sets_workdir_and_image,
      appends_command,
    },
  });

  test("omits volume mode when not readonly", {
    when: {
      building_args_with_rw_volume,
    },
    then: {
      rw_mount_has_no_mode_suffix,
    },
  });

  test("forwards passthrough env by name only", {
    when: {
      building_args_with_env_passthrough,
    },
    then: {
      passthrough_env_is_name_only,
    },
  });

  test("names the container and keeps stdin open when asked", {
    when: {
      building_args_with_name_and_stdin,
    },
    then: {
      names_the_container,
      keeps_stdin_open,
    },
  });
});

function building_args(this: Context) {
  this.args = buildDockerRunArgs({
    image: "example:local",
    uid: 1000,
    gid: 1000,
    workdir: "/workspace",
    env: { HOME: "/home/agent" },
    volumes: [
      { host: "/tmp/ws", container: "/workspace" },
      { host: "/tmp/auth.json", container: "/home/agent/auth.json", mode: "ro" },
    ],
    command: ["agent", "--", "hi"],
  });
}

function building_args_with_rw_volume(this: Context) {
  this.args = buildDockerRunArgs({
    image: "example:local",
    uid: 1,
    gid: 1,
    workdir: "/workspace",
    volumes: [{ host: "/tmp/ws", container: "/workspace" }],
    command: ["true"],
  });
}

function uses_host_uid_gid(this: Context) {
  expect(this.args).toContain("--user");
  expect(this.args[this.args.indexOf("--user") + 1]).toBe("1000:1000");
}

function sets_env(this: Context) {
  expect(this.args).toContain("HOME=/home/agent");
}

function mounts_volumes(this: Context) {
  expect(this.args).toContain("/tmp/ws:/workspace");
  expect(this.args).toContain("/tmp/auth.json:/home/agent/auth.json:ro");
}

function sets_workdir_and_image(this: Context) {
  expect(this.args).toContain("-w");
  expect(this.args[this.args.indexOf("-w") + 1]).toBe("/workspace");
  expect(this.args).toContain("example:local");
}

function appends_command(this: Context) {
  expect(this.args.at(-3)).toBe("agent");
  expect(this.args.at(-1)).toBe("hi");
}

function rw_mount_has_no_mode_suffix(this: Context) {
  expect(this.args).toContain("/tmp/ws:/workspace");
  expect(this.args.some((arg) => arg.includes("/tmp/ws:/workspace:"))).toBe(false);
}

function building_args_with_env_passthrough(this: Context) {
  this.args = buildDockerRunArgs({
    image: "example:local",
    uid: 1,
    gid: 1,
    workdir: "/workspace",
    env: { HOME: "/home/agent" },
    envPassthrough: ["SECRET_TOKEN"],
    command: ["true"],
  });
}

function passthrough_env_is_name_only(this: Context) {
  const envValues = this.args.filter((arg, i) => this.args[i - 1] === "-e");
  expect(envValues).toEqual(["HOME=/home/agent", "SECRET_TOKEN"]);
}

function building_args_with_name_and_stdin(this: Context) {
  this.args = buildDockerRunArgs({
    image: "example:local",
    uid: 1,
    gid: 1,
    workdir: "/workspace",
    name: "agent-gwt-test-1234",
    interactive: true,
    command: ["true"],
  });
}

function names_the_container(this: Context) {
  expect(this.args[this.args.indexOf("--name") + 1]).toBe("agent-gwt-test-1234");
}

function keeps_stdin_open(this: Context) {
  expect(this.args).toContain("-i");
}
