import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import { createAgent } from "./create-agent.js";
import * as ensureImageModule from "./ensure-image.js";
import * as buildImagesModule from "../images/build.js";
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

  test("buildImage builds the stock image folder", {
    given: {
      stub_ensure_and_build,
    },
    when: {
      creating_and_building_image,
    },
    then: {
      build_images_was_called,
    },
  });
});

function stub_ensure_and_build(this: Context) {
  this.runCalls = 0;
  vi.spyOn(ensureImageModule, "ensureDockerImage").mockResolvedValue();
  vi.spyOn(buildImagesModule, "buildImages").mockResolvedValue();
}

async function creating_and_running_agent(this: Context) {
  this.agent = createAgent({
    image: "clanker-cleanroom/cursor",
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
    image: "clanker-cleanroom/cursor",
    run: async (options) => {
      this.runCalls += 1;
      this.runOptions = options;
      return { ok: true };
    },
  });

  this.result = await this.agent.run({
    workspace: "/tmp/ws",
    prompt: "hello",
    image: "my-app/agent",
  });
}

async function creating_and_ensuring_image(this: Context) {
  this.agent = createAgent({
    image: "clanker-cleanroom/cursor",
    run: async () => ({}),
  });

  await this.agent.ensureImage();
}

async function creating_and_building_image(this: Context) {
  this.agent = createAgent({
    image: "clanker-cleanroom/cursor",
    run: async () => ({}),
  });

  await this.agent.buildImage();
}

function image_is_set(this: Context) {
  expect(this.agent.image).toBe("clanker-cleanroom/cursor");
}

function run_was_delegated_with_image(this: Context) {
  expect(this.runCalls).toBe(1);
  expect(this.runOptions).toEqual({
    workspace: "/tmp/ws",
    prompt: "hello",
    image: "clanker-cleanroom/cursor",
  });
  expect(this.result).toEqual({ ok: true });
}

function run_was_delegated_with_override_image(this: Context) {
  expect(this.runCalls).toBe(1);
  expect(this.runOptions).toEqual({
    workspace: "/tmp/ws",
    prompt: "hello",
    image: "my-app/agent",
  });
}

function ensure_docker_image_used_bound_image() {
  expect(ensureImageModule.ensureDockerImage).toHaveBeenCalledWith("clanker-cleanroom/cursor");
}

function build_images_was_called() {
  expect(buildImagesModule.buildImages).toHaveBeenCalledWith();
}
