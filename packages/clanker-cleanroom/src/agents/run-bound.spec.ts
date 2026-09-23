import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect } from "vitest";
import test from "vitest-gwt";

import { CONTAINER_OUTPUT } from "./base/constants.js";
import { CLANKER_PATH_REMAPS_ENV, serializeRemaps } from "./path-remaps.js";
import { runBoundAgent } from "./run-bound.js";
import { CONTAINER_TRAJECTORY_PATH, TRAJECTORY_FILE } from "./trajectory/index.js";
import type { AgentBinding, DockerRunner } from "./types.js";

type Context = {
  binding: AgentBinding;
  dockerRunner: DockerRunner;
  dockerArgs?: string[];
  dockerEnv?: Record<string, string>;
  outputHost?: string;
  parsedTrajectory?: string;
  result?: Awaited<ReturnType<typeof runBoundAgent>>;
  error?: Error;
};

afterEach(() => {
  delete process.env[CLANKER_PATH_REMAPS_ENV];
});

describe("runBoundAgent", () => {
  test("mounts workspace, redirects trajectory, and returns parseResult from the file", {
    given: {
      stub_binding,
      output_host_dir,
      docker_succeeds_writing_trajectory,
    },
    when: {
      running_bound_agent,
    },
    then: {
      docker_received_workspace_mount,
      docker_command_redirects_to_trajectory,
      parse_result_received_trajectory_file,
      result_from_parse,
    },
  });

  test("mounts io volumes after workspace and before credentials", {
    given: {
      stub_binding,
      output_host_dir,
      docker_succeeds_writing_trajectory,
    },
    when: {
      running_bound_agent,
    },
    then: {
      docker_received_io_mounts_in_order,
    },
  });

  test("throws agentRunError when docker exits non-zero", {
    given: {
      stub_binding,
      output_host_dir,
      docker_fails,
    },
    when: {
      running_bound_agent_catching,
    },
    then: {
      error_names_agent,
    },
  });

  test("requires an output volume for trajectory capture", {
    given: {
      stub_binding,
      docker_succeeds_without_writing,
    },
    when: {
      running_bound_agent_without_io_catching,
    },
    then: {
      error_requires_output_volume,
    },
  });

  test("injects remaps into the child without remapping this run's volumes", {
    given: {
      stub_binding,
      output_host_dir,
      docker_succeeds_writing_trajectory,
    },
    when: {
      running_bound_agent_with_remaps,
    },
    then: {
      docker_volumes_unremapped,
      child_receives_remaps_env,
    },
  });

  test("applies inherited remaps to volume hosts and nests composed remaps", {
    given: {
      stub_binding,
      output_host_dir,
      inherited_remaps_env,
      docker_succeeds_writing_trajectory,
    },
    when: {
      running_bound_agent_with_nested_remaps,
    },
    then: {
      docker_volumes_remapped_via_inherited,
      child_receives_composed_remaps,
      trajectory_still_read_from_local_output,
    },
  });
});

function stub_binding(this: Context) {
  this.binding = {
    image: "test/image",
    displayName: "TestAgent",
    trajectoryKind: "test",
    adaptEvents: () => [],
    command: ({ prompt }) => ["tool", "--", prompt],
    prepare: async () => ({
      volumes: [{ host: "/tmp/secret", container: "/secret", mode: "ro" }],
      env: { SECRET: "value" },
    }),
    parseResult: (trajectory) => {
      this.parsedTrajectory = trajectory;
      return {
        durationMs: 42,
        costUsd: 0.01,
        usage: {
          inputTokens: 1,
          outputTokens: 2,
          cacheReadTokens: null,
          cacheWriteTokens: null,
        },
      };
    },
  };
}

async function output_host_dir(this: Context) {
  this.outputHost = await mkdtemp(join(tmpdir(), "clanker-out-"));
}

function inherited_remaps_env() {
  process.env[CLANKER_PATH_REMAPS_ENV] = serializeRemaps({
    "/tmp": "/host/tmp",
  });
}

function docker_succeeds_writing_trajectory(this: Context) {
  this.dockerRunner = async (args, options) => {
    this.dockerArgs = args;
    this.dockerEnv = options?.env ?? {};
    await mkdir(this.outputHost!, { recursive: true });
    await writeFile(
      join(this.outputHost!, TRAJECTORY_FILE),
      `${JSON.stringify({ type: "result", result: "ok" })}\n`,
    );
    return { exitCode: 0, stdout: "", stderr: "" };
  };
}

function docker_succeeds_without_writing(this: Context) {
  this.dockerRunner = async (args, options) => {
    this.dockerArgs = args;
    this.dockerEnv = options?.env ?? {};
    return { exitCode: 0, stdout: "", stderr: "" };
  };
}

function docker_fails(this: Context) {
  this.dockerRunner = async () => ({
    exitCode: 1,
    stdout: "",
    stderr: "boom",
  });
}

async function running_bound_agent(this: Context) {
  this.result = await runBoundAgent(
    this.binding,
    {
      workspace: "/tmp/ws",
      prompt: "hi",
      image: "test/image",
      uid: 1,
      gid: 1,
      ioVolumes: [
        { host: "/tmp/in", container: "/agent/input", mode: "ro" },
        { host: this.outputHost!, container: CONTAINER_OUTPUT },
      ],
    },
    this.dockerRunner,
  );
}

async function running_bound_agent_with_remaps(this: Context) {
  this.result = await runBoundAgent(
    this.binding,
    {
      workspace: "/tmp/ws",
      prompt: "hi",
      image: "test/image",
      uid: 1,
      gid: 1,
      remaps: { "/inside/path": "/host/path" },
      ioVolumes: [
        { host: "/tmp/in", container: "/agent/input", mode: "ro" },
        { host: this.outputHost!, container: CONTAINER_OUTPUT },
      ],
    },
    this.dockerRunner,
  );
}

async function running_bound_agent_with_nested_remaps(this: Context) {
  this.result = await runBoundAgent(
    this.binding,
    {
      workspace: "/tmp/ws",
      prompt: "hi",
      image: "test/image",
      uid: 1,
      gid: 1,
      remaps: { "/nested": "/tmp/nested" },
      ioVolumes: [
        { host: "/tmp/in", container: "/agent/input", mode: "ro" },
        { host: this.outputHost!, container: CONTAINER_OUTPUT },
      ],
    },
    this.dockerRunner,
  );
}

async function running_bound_agent_without_io_catching(this: Context) {
  try {
    await runBoundAgent(
      this.binding,
      { workspace: "/tmp/ws", prompt: "hi", image: "test/image", uid: 1, gid: 1 },
      this.dockerRunner,
    );
  } catch (error) {
    this.error = error as Error;
  }
}

async function running_bound_agent_catching(this: Context) {
  try {
    await running_bound_agent.call(this);
  } catch (error) {
    this.error = error as Error;
  }
}

function docker_received_workspace_mount(this: Context) {
  expect(this.dockerArgs).toContain("/tmp/ws:/workspace");
  expect(this.dockerArgs).toContain("/tmp/secret:/secret:ro");
  expect(this.dockerEnv).toEqual({ SECRET: "value" });
  expect(this.dockerArgs).toContain("SECRET");
}

function docker_command_redirects_to_trajectory(this: Context) {
  expect(this.dockerArgs).toContain("sh");
  expect(this.dockerArgs).toContain("-c");
  expect(this.dockerArgs).toContain(`exec "$@" > ${CONTAINER_TRAJECTORY_PATH}`);
  expect(this.dockerArgs).toContain("tool");
  expect(this.dockerArgs?.at(-1)).toBe("hi");
}

function parse_result_received_trajectory_file(this: Context) {
  expect(this.parsedTrajectory).toContain('"type":"result"');
}

function docker_received_io_mounts_in_order(this: Context) {
  const args = this.dockerArgs ?? [];
  const workspaceIndex = args.indexOf("/tmp/ws:/workspace");
  const inputIndex = args.indexOf("/tmp/in:/agent/input:ro");
  const outputIndex = args.indexOf(`${this.outputHost}:${CONTAINER_OUTPUT}`);
  const secretIndex = args.indexOf("/tmp/secret:/secret:ro");

  expect(workspaceIndex).toBeGreaterThan(-1);
  expect(inputIndex).toBeGreaterThan(workspaceIndex);
  expect(outputIndex).toBeGreaterThan(inputIndex);
  expect(secretIndex).toBeGreaterThan(outputIndex);
}

function result_from_parse(this: Context) {
  expect(this.result).toEqual({
    durationMs: 42,
    costUsd: 0.01,
    usage: {
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    },
  });
}

function error_names_agent(this: Context) {
  expect(this.error?.message).toContain("TestAgent agent exited with code 1");
}

function error_requires_output_volume(this: Context) {
  expect(this.error?.message).toContain(CONTAINER_OUTPUT);
}

function docker_volumes_unremapped(this: Context) {
  expect(this.dockerArgs).toContain("/tmp/ws:/workspace");
  expect(this.dockerArgs).toContain("/tmp/in:/agent/input:ro");
  expect(this.dockerArgs).toContain(`${this.outputHost}:${CONTAINER_OUTPUT}`);
  expect(this.dockerArgs).toContain("/tmp/secret:/secret:ro");
}

function child_receives_remaps_env(this: Context) {
  const remapsFlag = this.dockerArgs?.find(
    (arg, index) =>
      this.dockerArgs?.[index - 1] === "-e" && arg.startsWith(`${CLANKER_PATH_REMAPS_ENV}=`),
  );
  expect(remapsFlag).toBe(
    `${CLANKER_PATH_REMAPS_ENV}=${serializeRemaps({ "/inside/path": "/host/path" })}`,
  );
}

function docker_volumes_remapped_via_inherited(this: Context) {
  expect(this.dockerArgs).toContain("/host/tmp/ws:/workspace");
  expect(this.dockerArgs).toContain("/host/tmp/in:/agent/input:ro");
  expect(this.dockerArgs).toContain("/host/tmp/secret:/secret:ro");

  const remappedOutput = applyTmpRemap(this.outputHost!);
  expect(this.dockerArgs).toContain(`${remappedOutput}:${CONTAINER_OUTPUT}`);
}

function child_receives_composed_remaps(this: Context) {
  const remapsFlag = this.dockerArgs?.find(
    (arg, index) =>
      this.dockerArgs?.[index - 1] === "-e" && arg.startsWith(`${CLANKER_PATH_REMAPS_ENV}=`),
  );
  expect(remapsFlag).toBe(
    `${CLANKER_PATH_REMAPS_ENV}=${serializeRemaps({
      "/tmp": "/host/tmp",
      "/nested": "/host/tmp/nested",
    })}`,
  );
}

function trajectory_still_read_from_local_output(this: Context) {
  expect(this.parsedTrajectory).toContain('"type":"result"');
}

function applyTmpRemap(hostPath: string): string {
  if (hostPath === "/tmp" || hostPath.startsWith("/tmp/")) {
    return `/host/tmp${hostPath.slice("/tmp".length)}`;
  }
  return hostPath;
}
