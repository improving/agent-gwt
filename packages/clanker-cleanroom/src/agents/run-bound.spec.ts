import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { runBoundAgent } from "./run-bound.js";
import type { AgentBinding, DockerRunner } from "./types.js";

type Context = {
  binding: AgentBinding;
  dockerRunner: DockerRunner;
  dockerArgs?: string[];
  dockerEnv?: Record<string, string>;
  result?: Awaited<ReturnType<typeof runBoundAgent>>;
  error?: Error;
};

describe("runBoundAgent", () => {
  test("mounts workspace, runs docker, and returns parseResult", {
    given: {
      stub_binding,
      docker_succeeds,
    },
    when: {
      running_bound_agent,
    },
    then: {
      docker_received_workspace_mount,
      result_from_parse,
    },
  });

  test("throws agentRunError when docker exits non-zero", {
    given: {
      stub_binding,
      docker_fails,
    },
    when: {
      running_bound_agent_catching,
    },
    then: {
      error_names_agent,
    },
  });
});

function stub_binding(this: Context) {
  this.binding = {
    image: "test/image",
    displayName: "TestAgent",
    command: ({ prompt }) => ["tool", "--", prompt],
    prepare: async () => ({
      volumes: [{ host: "/tmp/secret", container: "/secret", mode: "ro" }],
      env: { SECRET: "value" },
    }),
    parseResult: () => ({
      durationMs: 42,
      costUsd: 0.01,
      usage: {
        inputTokens: 1,
        outputTokens: 2,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      },
    }),
  };
}

function docker_succeeds(this: Context) {
  this.dockerRunner = async (args, options) => {
    this.dockerArgs = args;
    this.dockerEnv = options?.env ?? {};
    return { exitCode: 0, stdout: "{}", stderr: "" };
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
    { workspace: "/tmp/ws", prompt: "hi", image: "test/image", uid: 1, gid: 1 },
    this.dockerRunner,
  );
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
