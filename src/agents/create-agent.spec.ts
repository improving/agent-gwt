import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import * as buildAgentImageModule from "./build-agent-image.js";
import { createAgent } from "./create-agent.js";
import * as ensureImageModule from "./ensure-image.js";
import type { Agent, AgentRunBindingsOptions, RunAgentOptions } from "./types.js";

type Context = {
  agent: Agent;
  runCalls: number;
  runOptions?: AgentRunBindingsOptions;
  result?: unknown;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createAgent", () => {
  test("exposes image and injects it when delegating run", {
    given: {
      stub_ensure_and_build,
    },
    when: {
      creating_and_running_agent,
    },
    then: {
      image_is_set,
      run_was_delegated_with_image,
    },
  });

  test("prefers an image override on run options", {
    given: {
      stub_ensure_and_build,
    },
    when: {
      creating_and_running_agent_with_image_override,
    },
    then: {
      run_was_delegated_with_override_image,
    },
  });

  test("ensureImage asserts the bound image exists", {
    given: {
      stub_ensure_and_build,
    },
    when: {
      creating_and_ensuring_image,
    },
    then: {
      ensure_docker_image_used_bound_image,
    },
  });

  test("buildImage builds base then the bound agent image", {
    given: {
      stub_ensure_and_build,
    },
    when: {
      creating_and_building_image,
    },
    then: {
      base_then_agent_image_were_built,
    },
  });
});

function stub_ensure_and_build(this: Context) {
  this.runCalls = 0;
  vi.spyOn(ensureImageModule, "ensureDockerImage").mockResolvedValue();
  vi.spyOn(buildAgentImageModule, "buildBaseImage").mockResolvedValue();
  vi.spyOn(buildAgentImageModule, "buildDockerImage").mockResolvedValue();
}

async function creating_and_running_agent(this: Context) {
  this.agent = createAgent({
    dockerfileRelative: "docker/cursor/Dockerfile",
    packageRoot: "/resolved/package",
    image: "agent-gwt/test:local",
    run: async (options) => {
      this.runCalls += 1;
      this.runOptions = options;
      return { ok: true };
    },
  });

  const options: RunAgentOptions = {
    workspace: "/tmp/ws",
    prompt: "hello",
  };
  this.result = await this.agent.run(options);
}

async function creating_and_running_agent_with_image_override(this: Context) {
  this.agent = createAgent({
    dockerfileRelative: "docker/cursor/Dockerfile",
    packageRoot: "/resolved/package",
    image: "agent-gwt/test:local",
    run: async (options) => {
      this.runCalls += 1;
      this.runOptions = options;
      return { ok: true };
    },
  });

  this.result = await this.agent.run({
    workspace: "/tmp/ws",
    prompt: "hello",
    image: "my-app/agent:local",
  });
}

async function creating_and_ensuring_image(this: Context) {
  this.agent = createAgent({
    dockerfileRelative: "docker/cursor/Dockerfile",
    packageRoot: "/resolved/package",
    image: "agent-gwt/test:local",
    run: async () => ({}),
  });

  await this.agent.ensureImage();
}

async function creating_and_building_image(this: Context) {
  this.agent = createAgent({
    dockerfileRelative: "docker/cursor/Dockerfile",
    packageRoot: "/resolved/package",
    image: "agent-gwt/test:local",
    run: async () => ({}),
  });

  await this.agent.buildImage();
}

function image_is_set(this: Context) {
  expect(this.agent.image).toBe("agent-gwt/test:local");
}

function run_was_delegated_with_image(this: Context) {
  expect(this.runCalls).toBe(1);
  expect(this.runOptions).toEqual({
    workspace: "/tmp/ws",
    prompt: "hello",
    image: "agent-gwt/test:local",
  });
  expect(this.result).toEqual({ ok: true });
}

function run_was_delegated_with_override_image(this: Context) {
  expect(this.runCalls).toBe(1);
  expect(this.runOptions).toEqual({
    workspace: "/tmp/ws",
    prompt: "hello",
    image: "my-app/agent:local",
  });
}

function ensure_docker_image_used_bound_image() {
  expect(ensureImageModule.ensureDockerImage).toHaveBeenCalledWith("agent-gwt/test:local");
}

function base_then_agent_image_were_built() {
  expect(buildAgentImageModule.buildBaseImage).toHaveBeenCalledWith();
  expect(buildAgentImageModule.buildDockerImage).toHaveBeenCalledWith("agent-gwt/test:local", {
    dockerfileRelative: "docker/cursor/Dockerfile",
    packageRoot: "/resolved/package",
  });
}
