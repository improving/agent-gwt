import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import { Agent } from "./agent.js";
import { registerBinding, resetBindings } from "./binding-registry.js";
import * as ensureImageModule from "./ensure-image.js";
import * as buildImagesModule from "../images/build.js";
import { resetRegistry, upsertRegistryEntry } from "../images/registry.js";
import * as runBoundModule from "./run-bound.js";
import { BASE_IMAGE } from "./base/constants.js";
import type { AgentBinding, AgentRunResult } from "./types.js";

const STOCK_IMAGE = "test/stock-agent";

type Context = {
  packageRoot: string;
  agent?: Agent;
  result?: AgentRunResult;
  error?: Error;
  inputAfterRuns?: string;
  outputListed?: string[];
};

afterEach(() => {
  vi.restoreAllMocks();
  resetBindings();
});

describe("Agent", () => {
  test("resolves a registered stock agent by short name", {
    given: {
      registered_stock_binding,
    },
    when: {
      constructing_stock,
    },
    then: {
      name_and_image_are_stock,
    },
  });

  test("resolves a registry toolchain tag using stored agent", {
    given: {
      registered_stock_binding,
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
      registered_stock_binding,
      stub_run_bound,
    },
    when: {
      constructing_and_running_stock,
    },
    then: {
      run_bound_used_stock_image,
      run_bound_received_io_volumes,
    },
  });

  test("clears output between runs but keeps input", {
    given: {
      registered_stock_binding,
      stub_run_bound,
    },
    when: {
      writing_io_and_running_twice,
    },
    then: {
      input_still_present,
      output_cleared_before_second_run,
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
      registered_stock_binding,
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

function stockBinding(): AgentBinding {
  return {
    image: STOCK_IMAGE,
    displayName: "Stock",
    trajectoryKind: "stock",
    adaptEvents: () => [],
    command: () => ["agent"],
    prepare: async () => ({}),
    parseResult: () => ({
      durationMs: null,
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

function registered_stock_binding() {
  registerBinding("stock", stockBinding());
}

function empty_package_root(this: Context) {
  this.packageRoot = mkdtempSync(join(tmpdir(), "clanker-agent-"));
  resetRegistry({ packageRoot: this.packageRoot });
}

function package_root_with_toolchain(this: Context) {
  empty_package_root.call(this);
  upsertRegistryEntry(
    "stock:node",
    {
      image: "stock:node",
      dockerfile: "node.Dockerfile",
      builtAt: new Date().toISOString(),
      agent: "stock",
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

function constructing_stock(this: Context) {
  this.agent = new Agent("stock");
}

function constructing_toolchain(this: Context) {
  this.agent = new Agent("stock:node", { packageRoot: this.packageRoot });
}

async function constructing_toolchain_and_building(this: Context) {
  constructing_toolchain.call(this);
  await this.agent!.buildImage();
}

async function constructing_and_running_stock(this: Context) {
  this.agent = new Agent("stock");
  this.result = await this.agent.run({ workspace: "/tmp/ws", prompt: "hi" });
}

async function writing_io_and_running_twice(this: Context) {
  this.agent = new Agent("stock");
  await this.agent.input.write("spec.txt", "keep-me");
  await this.agent.output.write("stale.txt", "gone");
  await this.agent.run({ workspace: "/tmp/ws", prompt: "first" });
  await this.agent.output.write("produced.txt", "from-agent");
  await this.agent.run({ workspace: "/tmp/ws", prompt: "second" });
  this.inputAfterRuns = await this.agent.input.readText("spec.txt");
  this.outputListed = await this.agent.output.list();
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

function name_and_image_are_stock(this: Context) {
  expect(this.agent?.name).toBe("stock");
  expect(this.agent?.image).toBe(STOCK_IMAGE);
}

function name_and_image_are_toolchain(this: Context) {
  expect(this.agent?.name).toBe("stock:node");
  expect(this.agent?.image).toBe("stock:node");
}

function run_bound_used_stock_image(this: Context) {
  expect(runBoundModule.runBoundAgent).toHaveBeenCalledWith(
    expect.objectContaining({ image: STOCK_IMAGE }),
    expect.objectContaining({
      workspace: "/tmp/ws",
      prompt: "hi",
      image: STOCK_IMAGE,
    }),
  );
  expect(this.result?.durationMs).toBe(10);
}

function run_bound_received_io_volumes(this: Context) {
  expect(runBoundModule.runBoundAgent).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      ioVolumes: [
        expect.objectContaining({ container: "/agent/input", mode: "ro" }),
        expect.objectContaining({ container: "/agent/output" }),
      ],
    }),
  );
}

function input_still_present(this: Context) {
  expect(this.inputAfterRuns).toBe("keep-me");
}

function output_cleared_before_second_run(this: Context) {
  expect(this.outputListed).toEqual([]);
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
