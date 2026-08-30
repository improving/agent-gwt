import { describe, expect, vi } from "vitest";
import test, { withAspect } from "vitest-gwt";

import * as toolchainModule from "../agents/build-toolchain-image.js";
import * as ensureImageModule from "../agents/ensure-image.js";
import { agentRegistry, type AgentName } from "../agents/registry.js";
import { CLAUDE_IMAGE } from "../agents/claude/constants.js";
import { CURSOR_IMAGE } from "../agents/cursor/constants.js";
import { agent } from "./agent.js";
import type { AgentContext } from "../types.js";

type Context = AgentContext & {
  ensureCalls: number;
  ensuredImage: string | undefined;
  error: Error | undefined;
  variant: string;
  toolchainImage: string;
};

describe("agent", () => {
  withAspect(reset_agent_test_state, undefined);

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

  test("resolves a registered toolchain variant", {
    given: {
      stub_ensure_docker_image,
      registered_toolchain_variant,
    },
    when: {
      applying_agent_with_variant,
    },
    then: {
      agent_is: agent_is("cursor"),
      image_is_toolchain_variant,
      ensure_was_called_with_toolchain,
    },
  });

  test("throws when the toolchain variant is unknown", {
    given: {
      stub_ensure_docker_image,
    },
    when: {
      applying_agent_with_unknown_variant,
    },
    then: {
      error_mentions_unknown_variant,
    },
  });

  test("throws when both image and variant are set", {
    given: {
      stub_ensure_docker_image,
    },
    when: {
      applying_agent_with_image_and_variant,
    },
    then: {
      error_mentions_mutual_exclusion,
    },
  });

  test("puts timeoutMs on the context", {
    given: {
      stub_ensure_docker_image,
    },
    when: {
      applying_agent: agent({ name: "cursor", timeoutMs: 1234 }),
    },
    then: {
      timeout_is: timeout_is(1234),
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

function reset_agent_test_state(this: Context) {
  vi.restoreAllMocks();
  this.ensureCalls = 0;
  this.ensuredImage = undefined;
  this.error = undefined;
}

function stub_ensure_docker_image(this: Context) {
  this.ensureCalls = 0;
  vi.spyOn(ensureImageModule, "ensureDockerImage").mockImplementation(async (image) => {
    this.ensureCalls += 1;
    this.ensuredImage = image;
  });
}

function registered_toolchain_variant(this: Context) {
  this.variant = "node18";
  this.toolchainImage = "agent-gwt/toolchain-cursor-abcd1234ef00:fedcba987654";
  vi.spyOn(toolchainModule, "resolveToolchainImage").mockImplementation((agentName, variant) => {
    if (agentName === "cursor" && variant === this.variant) {
      return this.toolchainImage;
    }
    return undefined;
  });
}

async function applying_agent_with_variant(this: Context) {
  await agent({ name: "cursor", variant: this.variant, model: "auto" }).call(this);
}

async function applying_agent_with_unknown_variant(this: Context) {
  try {
    await agent({ name: "cursor", variant: "missing" }).call(this);
  } catch (error) {
    this.error = error as Error;
  }
}

async function applying_agent_with_image_and_variant(this: Context) {
  try {
    await agent({
      name: "cursor",
      image: "my-app/agent:local",
      variant: "node18",
    }).call(this);
  } catch (error) {
    this.error = error as Error;
  }
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

function image_is_toolchain_variant(this: Context) {
  expect(this.image).toBe(this.toolchainImage);
}

function ensure_was_called_with(image: string) {
  return function (this: Context) {
    expect(this.ensureCalls).toBe(1);
    expect(this.ensuredImage).toBe(image);
  };
}

function ensure_was_called_with_toolchain(this: Context) {
  expect(this.ensureCalls).toBe(1);
  expect(this.ensuredImage).toBe(this.toolchainImage);
}

function error_mentions_unknown_variant(this: Context) {
  expect(this.error?.message).toContain('Unknown toolchain variant "missing"');
  expect(this.error?.message).toContain("buildToolchainImage");
}

function error_mentions_mutual_exclusion(this: Context) {
  expect(this.error?.message).toContain("cannot set both image and variant");
}

function timeout_is(timeoutMs: number) {
  return function (this: Context) {
    expect(this.timeoutMs).toBe(timeoutMs);
  };
}
