import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import { Agent } from "./agent.js";
import * as ensureImageModule from "./ensure-image.js";
import * as buildImagesModule from "../images/build.js";
import { resetRegistry, upsertRegistryEntry } from "../images/registry.js";
import * as runBoundModule from "./run-bound.js";
import { CURSOR_IMAGE } from "./cursor/constants.js";
import { BASE_IMAGE } from "./base/constants.js";
import type { AgentRunResult } from "./types.js";

type Context = {
  packageRoot: string;
  agent?: Agent;
  result?: AgentRunResult;
  error?: Error;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Agent", () => {
  test("resolves stock cursor by short name", {
    when: {
      constructing_cursor,
    },
    then: {
      name_and_image_are_cursor,
    },
  });

  test("resolves a registry toolchain tag using stored agent", {
    given: {
      package_root_with_toolchain,
    },
    when: {
      constructing_toolchain,
    },
    then: {
      name_and_image_are_toolchain,
    },
  });

  test("runs through runBoundAgent with the resolved image", {
    given: {
      stub_run_bound,
    },
    when: {
      constructing_and_running_cursor,
    },
    then: {
      run_bound_used_cursor_image,
    },
  });

  test("throws for an unknown name", {
    given: {
      empty_package_root,
    },
    when: {
      constructing_unknown_catching,
    },
    then: {
      error_mentions_unknown,
    },
  });

  test("throws for a non-agent registry image", {
    given: {
      package_root_with_base,
    },
    when: {
      constructing_base_catching,
    },
    then: {
      error_mentions_not_runnable,
    },
  });

  test("buildImage forwards packageRoot from the constructor", {
    given: {
      package_root_with_toolchain,
      stub_build_images,
    },
    when: {
      constructing_toolchain_and_building,
    },
    then: {
      build_images_used_package_root,
    },
  });
});

function empty_package_root(this: Context) {
  this.packageRoot = mkdtempSync(join(tmpdir(), "clanker-agent-"));
  resetRegistry({ packageRoot: this.packageRoot });
}

function package_root_with_toolchain(this: Context) {
  empty_package_root.call(this);
  upsertRegistryEntry(
    "cursor:node",
    {
      image: "cursor:node",
      dockerfile: "node.Dockerfile",
      builtAt: new Date().toISOString(),
      agent: "cursor",
    },
    { packageRoot: this.packageRoot },
  );
}

function package_root_with_base(this: Context) {
  empty_package_root.call(this);
  upsertRegistryEntry(
    BASE_IMAGE,
    {
      image: BASE_IMAGE,
      dockerfile: "base.Dockerfile",
      builtAt: new Date().toISOString(),
    },
    { packageRoot: this.packageRoot },
  );
}

function stub_build_images() {
  vi.spyOn(buildImagesModule, "buildImages").mockResolvedValue();
}

function stub_run_bound(this: Context) {
  vi.spyOn(ensureImageModule, "ensureDockerImage").mockResolvedValue();
  vi.spyOn(buildImagesModule, "buildImages").mockResolvedValue();
  vi.spyOn(runBoundModule, "runBoundAgent").mockResolvedValue({
    durationMs: 10,
    costUsd: null,
    usage: {
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    },
  });
}

function constructing_cursor(this: Context) {
  this.agent = new Agent("cursor");
}

function constructing_toolchain(this: Context) {
  this.agent = new Agent("cursor:node", { packageRoot: this.packageRoot });
}

async function constructing_toolchain_and_building(this: Context) {
  constructing_toolchain.call(this);
  await this.agent!.buildImage();
}

async function constructing_and_running_cursor(this: Context) {
  this.agent = new Agent("cursor");
  this.result = await this.agent.run({ workspace: "/tmp/ws", prompt: "hi" });
}

function constructing_unknown_catching(this: Context) {
  try {
    this.agent = new Agent("missing", { packageRoot: this.packageRoot });
  } catch (error) {
    this.error = error as Error;
  }
}

function constructing_base_catching(this: Context) {
  try {
    this.agent = new Agent(BASE_IMAGE, { packageRoot: this.packageRoot });
  } catch (error) {
    this.error = error as Error;
  }
}

function name_and_image_are_cursor(this: Context) {
  expect(this.agent?.name).toBe("cursor");
  expect(this.agent?.image).toBe(CURSOR_IMAGE);
}

function name_and_image_are_toolchain(this: Context) {
  expect(this.agent?.name).toBe("cursor:node");
  expect(this.agent?.image).toBe("cursor:node");
}

function run_bound_used_cursor_image(this: Context) {
  expect(runBoundModule.runBoundAgent).toHaveBeenCalledWith(
    expect.objectContaining({ image: CURSOR_IMAGE }),
    expect.objectContaining({
      workspace: "/tmp/ws",
      prompt: "hi",
      image: CURSOR_IMAGE,
    }),
  );
  expect(this.result?.durationMs).toBe(10);
}

function error_mentions_unknown(this: Context) {
  expect(this.error?.message).toContain('Unknown agent "missing"');
}

function error_mentions_not_runnable(this: Context) {
  expect(this.error?.message).toContain("not a runnable agent");
}

function build_images_used_package_root(this: Context) {
  expect(buildImagesModule.buildImages).toHaveBeenCalledWith({
    packageRoot: this.packageRoot,
  });
}
