import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect } from "vitest";
import test, { withAspect } from "vitest-gwt";

import { CONTAINER_OUTPUT } from "./base/constants.js";
import { runBoundAgent } from "./run-bound.js";
import { TRAJECTORY_FILE } from "./trajectory/index.js";
import type { AgentBinding, DockerRunOptions, DockerRunner } from "./types.js";

const KIB = 1024;
const PROMPT_MARKER = "PROMPT_MARKER_";

describe("runBoundAgent prompt over stdin", () => {
  withAspect(a_temp_output_host, remove_temp_output_host);

  test("delivers a small prompt through docker run -i stdin, not argv", {
    given: {
      binding_without_prompt_on_argv,
      docker_succeeds_writing_trajectory,
      small_prompt,
    },
    when: {
      running_bound_agent_with_prompt,
    },
    then: {
      docker_run_is_interactive,
      prompt_is_piped_on_docker_stdin,
      prompt_bytes_are_absent_from_docker_argv,
      every_argv_element_is_under_128_kib,
    },
  });

  test("delivers a ~120 KB prompt through docker run -i stdin, not argv", {
    given: {
      binding_without_prompt_on_argv,
      docker_succeeds_writing_trajectory,
      prompt_of_120_kib,
    },
    when: {
      running_bound_agent_with_prompt,
    },
    then: {
      docker_run_is_interactive,
      prompt_is_piped_on_docker_stdin,
      prompt_bytes_are_absent_from_docker_argv,
      every_argv_element_is_under_128_kib,
    },
  });

  test("delivers a 128 KB prompt through docker run -i stdin, not argv", {
    given: {
      binding_without_prompt_on_argv,
      docker_succeeds_writing_trajectory,
      prompt_of_128_kib,
    },
    when: {
      running_bound_agent_with_prompt,
    },
    then: {
      docker_run_is_interactive,
      prompt_is_piped_on_docker_stdin,
      prompt_bytes_are_absent_from_docker_argv,
      every_argv_element_is_under_128_kib,
    },
  });

  test("delivers a ~130 KB prompt through docker run -i stdin, not argv", {
    given: {
      binding_without_prompt_on_argv,
      docker_succeeds_writing_trajectory,
      prompt_of_130_kib,
    },
    when: {
      running_bound_agent_with_prompt,
    },
    then: {
      docker_run_is_interactive,
      prompt_is_piped_on_docker_stdin,
      prompt_bytes_are_absent_from_docker_argv,
      every_argv_element_is_under_128_kib,
    },
  });

  test("delivers a ~200 KB prompt through docker run -i stdin, not argv", {
    given: {
      binding_without_prompt_on_argv,
      docker_succeeds_writing_trajectory,
      prompt_of_200_kib,
    },
    when: {
      running_bound_agent_with_prompt,
    },
    then: {
      docker_run_is_interactive,
      prompt_is_piped_on_docker_stdin,
      prompt_bytes_are_absent_from_docker_argv,
      every_argv_element_is_under_128_kib,
    },
  });
});

type Context = {
  binding: AgentBinding;
  dockerRunner: DockerRunner;
  dockerArgs: string[];
  dockerOptions: DockerRunOptions;
  outputHost: string;
  prompt: string;
};

type DockerRunOptionsWithInput = DockerRunOptions & {
  input?: string;
};

async function a_temp_output_host(this: Context) {
  this.outputHost = await mkdtemp(join(tmpdir(), "clanker-stdin-out-"));
}

async function remove_temp_output_host(this: Context) {
  if (this.outputHost === undefined || this.outputHost === "") {
    return;
  }
  await rm(this.outputHost, { recursive: true, force: true });
}

function binding_without_prompt_on_argv(this: Context) {
  this.binding = {
    image: "test/image",
    displayName: "TestAgent",
    trajectoryKind: "test",
    adaptEvents: () => [],
    command: () => ["tool", "-p", "--force"],
    prepare: async () => ({}),
    parseResult: () => ({
      durationMs: 1,
      costUsd: null,
      usage: {
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      },
    }),
  };
}

function docker_succeeds_writing_trajectory(this: Context) {
  this.dockerArgs = [];
  this.dockerOptions = {};
  this.dockerRunner = async (args, options = {}) => {
    this.dockerArgs = args;
    this.dockerOptions = options;
    await mkdir(this.outputHost, { recursive: true });
    await writeFile(
      join(this.outputHost, TRAJECTORY_FILE),
      `${JSON.stringify({ type: "result", result: "ok" })}\n`,
    );
    return { exitCode: 0, stdout: "", stderr: "" };
  };
}

function small_prompt(this: Context) {
  this.prompt = `${PROMPT_MARKER}small`;
}

function prompt_of_120_kib(this: Context) {
  this.prompt = sized_prompt(120 * KIB);
}

function prompt_of_128_kib(this: Context) {
  this.prompt = sized_prompt(128 * KIB);
}

function prompt_of_130_kib(this: Context) {
  this.prompt = sized_prompt(130 * KIB);
}

function prompt_of_200_kib(this: Context) {
  this.prompt = sized_prompt(200 * KIB);
}

async function running_bound_agent_with_prompt(this: Context) {
  await runBoundAgent(
    this.binding,
    {
      workspace: "/tmp/ws",
      prompt: this.prompt,
      image: "test/image",
      uid: 1,
      gid: 1,
      ioVolumes: [
        { host: "/tmp/in", container: "/agent/input", mode: "ro" },
        { host: this.outputHost, container: CONTAINER_OUTPUT },
      ],
    },
    this.dockerRunner,
  );
}

function docker_run_is_interactive(this: Context) {
  expect(this.dockerArgs).toContain("-i");
}

function prompt_is_piped_on_docker_stdin(this: Context) {
  const options = this.dockerOptions as DockerRunOptionsWithInput;
  expect(options.input).toBe(this.prompt);
}

function prompt_bytes_are_absent_from_docker_argv(this: Context) {
  for (const arg of this.dockerArgs) {
    expect(arg.includes(PROMPT_MARKER)).toBe(false);
    expect(arg).not.toBe(this.prompt);
  }
}

function every_argv_element_is_under_128_kib(this: Context) {
  const maxArgBytes = 128 * KIB;
  for (const arg of this.dockerArgs) {
    expect(Buffer.byteLength(arg, "utf8")).toBeLessThan(maxArgBytes);
  }
}

function sized_prompt(byteLength: number): string {
  const prefix = PROMPT_MARKER;
  return prefix + "x".repeat(byteLength - prefix.length);
}
