import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import * as ensureImageModule from "../agents/ensure-image.js";
import { agentRegistry, type AgentName } from "../agents/registry.js";
import { CLAUDE_IMAGE } from "../agents/claude/constants.js";
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
      agent_is: agent_is("cursor"),
      model_is: model_is("auto"),
      image_is: image_is(CURSOR_IMAGE),
      ensure_was_called_with: ensure_was_called_with(CURSOR_IMAGE),
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
      agent_is: agent_is("cursor"),
      image_is: image_is("my-app/agent:local"),
      ensure_was_called_with: ensure_was_called_with("my-app/agent:local"),
    },
  });

  test("resolves the claude agent by name", {
    given: {
      stub_ensure_docker_image,
    },
    when: {
      applying_agent: agent({ name: "claude", model: "sonnet" }),
    },
    then: {
      agent_is: agent_is("claude"),
      model_is: model_is("sonnet"),
      image_is: image_is(CLAUDE_IMAGE),
      ensure_was_called_with: ensure_was_called_with(CLAUDE_IMAGE),
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

function agent_is(name: AgentName) {
  return function (this: Context) {
    expect(this.agent).toBe(agentRegistry[name]);
  };
}

function model_is(model: string) {
  return function (this: Context) {
    expect(this.model).toBe(model);
  };
}

function image_is(image: string) {
  return function (this: Context) {
    expect(this.image).toBe(image);
  };
}

function ensure_was_called_with(image: string) {
  return function (this: Context) {
    expect(this.ensureCalls).toBe(1);
    expect(this.ensuredImage).toBe(image);
  };
}
