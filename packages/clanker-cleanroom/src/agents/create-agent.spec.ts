import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import { Agent } from "./agent.js";
import { createAgent } from "./create-agent.js";
import * as ensureImageModule from "./ensure-image.js";
import * as buildImagesModule from "../images/build.js";
import * as runBoundModule from "./run-bound.js";
import type { AgentBinding, AgentRunResult } from "./types.js";

type Context = {
  agent: Agent;
  binding: AgentBinding;
  result?: AgentRunResult;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createAgent", () => {
  test("exposes image and delegates run to runBoundAgent", {
    given: {
      stub_binding_and_runner,
    },
    when: {
      creating_and_running_agent,
    },
    then: {
      image_is_set,
      run_bound_was_called,
    },
  });

  test("ensureImage asserts the bound image exists", {
    given: {
      stub_binding_and_runner,
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
      stub_binding_and_runner,
    },
    when: {
      creating_and_building_image,
    },
    then: {
      build_images_was_called,
    },
  });
});

function stub_binding_and_runner(this: Context) {
  this.binding = {
    image: "clanker-cleanroom/cursor",
    displayName: "Cursor",
    command: () => ["agent"],
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
  vi.spyOn(ensureImageModule, "ensureDockerImage").mockResolvedValue();
  vi.spyOn(buildImagesModule, "buildImages").mockResolvedValue();
  vi.spyOn(runBoundModule, "runBoundAgent").mockResolvedValue(this.binding.parseResult(""));
}

async function creating_and_running_agent(this: Context) {
  this.agent = createAgent(this.binding);
  this.result = await this.agent.run({
    workspace: "/tmp/ws",
    prompt: "hello",
  });
}

async function creating_and_ensuring_image(this: Context) {
  this.agent = createAgent(this.binding);
  await this.agent.ensureImage();
}

async function creating_and_building_image(this: Context) {
  this.agent = createAgent(this.binding);
  await this.agent.buildImage();
}

function image_is_set(this: Context) {
  expect(this.agent.image).toBe("clanker-cleanroom/cursor");
}

function run_bound_was_called(this: Context) {
  expect(runBoundModule.runBoundAgent).toHaveBeenCalledWith(
    expect.objectContaining({
      image: "clanker-cleanroom/cursor",
      displayName: "Cursor",
    }),
    {
      workspace: "/tmp/ws",
      prompt: "hello",
      image: "clanker-cleanroom/cursor",
    },
  );
  expect(this.result?.durationMs).toBe(1);
}

function ensure_docker_image_used_bound_image() {
  expect(ensureImageModule.ensureDockerImage).toHaveBeenCalledWith("clanker-cleanroom/cursor");
}

function build_images_was_called() {
  expect(buildImagesModule.buildImages).toHaveBeenCalledWith();
}
