import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { buildDockerRunArgs, CONTAINER_HOME, CONTAINER_WORKSPACE } from "clanker-cleanroom";

import { copilotBinding } from "./binding.js";
import { CONTAINER_COPILOT_HOME } from "./constants.js";

type Context = {
  args: string[];
};

describe("copilotBinding.command", () => {
  test("runs copilot programmatically with json output and full permissions", {
    when: {
      building_docker_args,
    },
    then: {
      uses_host_uid_gid,
      sets_container_home,
      mounts_workspace,
      mounts_copilot_home_read_only,
      invokes_copilot_with_json_output,
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
  this.args = dockerArgs({ model: "gpt-5" });
}

function dockerArgs(options: { model?: string } = {}): string[] {
  return buildDockerRunArgs({
    image: "clanker-cleanroom/copilot",
    uid: 1000,
    gid: 1000,
    workdir: CONTAINER_WORKSPACE,
    env: { HOME: CONTAINER_HOME },
    volumes: [
      { host: "/tmp/.agents-gwt/ws-abc", container: CONTAINER_WORKSPACE },
      { host: "/home/dev/.copilot", container: CONTAINER_COPILOT_HOME, mode: "ro" },
    ],
    command: copilotBinding.command({
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

function mounts_copilot_home_read_only(this: Context) {
  expect(this.args).toContain(`/home/dev/.copilot:${CONTAINER_COPILOT_HOME}:ro`);
}

function invokes_copilot_with_json_output(this: Context) {
  expect(this.args).toContain("copilot");
  expect(this.args).toContain("--output-format");
  expect(this.args).toContain("json");
  expect(this.args).toContain("--allow-all-tools");
  expect(this.args).toContain("--no-ask-user");
  expect(this.args.at(-1)).toBe("Create a README");
}

function includes_model_flag(this: Context) {
  const modelIndex = this.args.indexOf("--model");
  expect(modelIndex).toBeGreaterThan(-1);
  expect(this.args[modelIndex + 1]).toBe("gpt-5");
  expect(this.args.indexOf("-p")).toBeGreaterThan(modelIndex);
}
