import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, vi } from "vitest";
import test, { withAspect } from "vitest-gwt";

import { CLAUDE_IMAGE, CURSOR_IMAGE, resetRegistry, upsertRegistryEntry } from "clanker-cleanroom";
import * as cleanroom from "clanker-cleanroom";

import { agent } from "./agent.js";
import type { AgentContext } from "../types.js";

type Context = AgentContext & {
  ensureCalls: number;
  ensuredImage: string | undefined;
  error: Error | undefined;
  packageRoot: string;
  toolchainName: string;
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
      agent_name_is: agent_name_is("cursor"),
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
      agent_name_is: agent_name_is("cursor"),
      image_is: image_is("my-app/agent:local"),
      ensure_was_called_with: ensure_was_called_with("my-app/agent:local"),
    },
  });

  test("resolves a registered toolchain by name", {
    given: {
      stub_ensure_docker_image,
      registered_toolchain,
    },
    when: {
      applying_agent_with_toolchain,
    },
    then: {
      agent_name_is_toolchain,
      image_is_toolchain,
      ensure_was_called_with_toolchain,
    },
  });

  test("throws when the toolchain name is unknown", {
    given: {
      stub_ensure_docker_image,
      empty_registry_root,
    },
    when: {
      applying_unknown_toolchain,
    },
    then: {
      error_mentions_unknown_agent,
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
      agent_name_is: agent_name_is("claude"),
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
  vi.spyOn(cleanroom, "ensureDockerImage").mockImplementation(async (image) => {
    this.ensureCalls += 1;
    this.ensuredImage = image;
  });
}

function empty_registry_root(this: Context) {
  this.packageRoot = mkdtempSync(join(tmpdir(), "agent-gwt-reg-"));
  resetRegistry({ packageRoot: this.packageRoot });
}

function registered_toolchain(this: Context) {
  empty_registry_root.call(this);
  this.toolchainName = "cursor:node";
  this.toolchainImage = "cursor:node";
  upsertRegistryEntry(
    this.toolchainName,
    {
      image: this.toolchainImage,
      dockerfile: "node.Dockerfile",
      builtAt: new Date().toISOString(),
      agent: "cursor",
    },
    { packageRoot: this.packageRoot },
  );
}

async function applying_agent_with_toolchain(this: Context) {
  await agent({
    name: this.toolchainName,
    model: "auto",
    packageRoot: this.packageRoot,
  }).call(this);
}

async function applying_unknown_toolchain(this: Context) {
  try {
    await agent({ name: "missing:toolchain", packageRoot: this.packageRoot }).call(this);
  } catch (error) {
    this.error = error as Error;
  }
}

function agent_name_is(name: string) {
  return function (this: Context) {
    expect(this.agent.name).toBe(name);
  };
}

function agent_name_is_toolchain(this: Context) {
  expect(this.agent.name).toBe(this.toolchainName);
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

function image_is_toolchain(this: Context) {
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

function error_mentions_unknown_agent(this: Context) {
  expect(this.error?.message).toContain('Unknown agent "missing:toolchain"');
  expect(this.error?.message).toContain("buildImages");
}
