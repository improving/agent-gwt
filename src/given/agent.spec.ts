import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import * as ensureImageModule from "../agents/ensure-image.js";
import { agentRegistry } from "../agents/registry.js";
import { CURSOR_IMAGE } from "../agents/cursor/constants.js";
import { agent } from "./agent.js";
import type { AgentContext } from "../types.js";

type Context = AgentContext & {
  ensureCalls: number;
  ensuredImage?: string;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("agent", () => {
  test("sets agent, model, and image from the resolved agent", {
    given: {
      stub_ensure_docker_image,
    },
    when: {
      applying_agent: agent({ name: "cursor", model: "auto" }),
    },
    then: {
      agent_is_cursor,
      model_is_set,
      image_is_set_from_agent,
      ensure_was_called_with_cursor_image,
    },
  });

  test("uses an image override when provided", {
    given: {
      stub_ensure_docker_image,
    },
    when: {
      applying_agent: agent({ name: "cursor", image: "my-app/agent:local" }),
    },
    then: {
      agent_is_cursor,
      image_is_override,
      ensure_was_called_with_override_image,
    },
  });
});

function stub_ensure_docker_image(this: Context) {
  this.ensureCalls = 0;
  vi.spyOn(ensureImageModule, "ensureDockerImage").mockImplementation(async (image) => {
    this.ensureCalls += 1;
    this.ensuredImage = image;
  });
}

function agent_is_cursor(this: Context) {
  expect(this.agent).toBe(agentRegistry.cursor);
}

function model_is_set(this: Context) {
  expect(this.model).toBe("auto");
}

function image_is_set_from_agent(this: Context) {
  expect(this.image).toBe(CURSOR_IMAGE);
}

function image_is_override(this: Context) {
  expect(this.image).toBe("my-app/agent:local");
}

function ensure_was_called_with_cursor_image(this: Context) {
  expect(this.ensureCalls).toBe(1);
  expect(this.ensuredImage).toBe(CURSOR_IMAGE);
}

function ensure_was_called_with_override_image(this: Context) {
  expect(this.ensureCalls).toBe(1);
  expect(this.ensuredImage).toBe("my-app/agent:local");
}
