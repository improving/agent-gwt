import { mkdtempSync } from "node:fs";
import { writeFile } from "node:fs/promises";
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
import { BASE_IMAGE, CONTAINER_OUTPUT } from "./base/constants.js";
import { TRAJECTORY_FILE } from "./trajectory/index.js";
import type { AgentBinding, AgentRunResult, DockerVolumeMount } from "./types.js";

const STOCK_IMAGE = "test/stock-agent";
const STOCK_SESSION_PATH = "/home/agent/.stock/sessions";
const STOCK_SESSION_ID = "sess-stock-1";

type Context = {
  packageRoot: string;
  agent?: Agent;
  result?: AgentRunResult;
  error?: Error;
  inputAfterRuns?: string;
  outputListed?: string[];
  firstRunOptions?: runBoundModule.RunBoundAgentOptions | undefined;
  secondRunOptions?: runBoundModule.RunBoundAgentOptions | undefined;
  thirdRunOptions?: runBoundModule.RunBoundAgentOptions | undefined;
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

  test("resumes the same session on subsequent runs", {
    given: {
      registered_stock_binding,
      stub_run_bound_writing_session_trajectory,
    },
    when: {
      running_twice_for_resume,
    },
    then: {
      first_run_has_no_session_id,
      second_run_resumes_captured_session,
      session_volume_is_mounted,
      session_id_getter_matches,
    },
  });

  test("resetSession clears resume for the next run", {
    given: {
      registered_stock_binding,
      stub_run_bound_writing_session_trajectory,
    },
    when: {
      running_resetting_and_running_again,
    },
    then: {
      third_run_has_no_session_id,
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
    sessionDataPath: STOCK_SESSION_PATH,
    adaptEvents: () => [
      { kind: "system", sessionId: STOCK_SESSION_ID, model: null, raw: {} },
    ],
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

function stub_run_bound_writing_session_trajectory(this: Context) {
  vi.spyOn(ensureImageModule, "ensureDockerImage").mockResolvedValue();
  vi.spyOn(buildImagesModule, "buildImages").mockResolvedValue();
  vi.spyOn(runBoundModule, "runBoundAgent").mockImplementation(async (_binding, options) => {
    const outputHost = options.ioVolumes?.find(
      (volume: DockerVolumeMount) => volume.container === CONTAINER_OUTPUT,
    )?.host;
    if (outputHost !== undefined) {
      await writeFile(
        join(outputHost, TRAJECTORY_FILE),
        `${JSON.stringify({ type: "system", session_id: STOCK_SESSION_ID })}\n`,
      );
    }
    return {
      durationMs: 10,
      costUsd: null,
      usage: {
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      },
    };
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

async function running_twice_for_resume(this: Context) {
  this.agent = new Agent("stock");
  await this.agent.run({ workspace: "/tmp/ws", prompt: "first" });
  this.firstRunOptions = vi.mocked(runBoundModule.runBoundAgent).mock.calls[0]?.[1];
  await this.agent.run({ workspace: "/tmp/ws", prompt: "second" });
  this.secondRunOptions = vi.mocked(runBoundModule.runBoundAgent).mock.calls[1]?.[1];
}

async function running_resetting_and_running_again(this: Context) {
  this.agent = new Agent("stock");
  await this.agent.run({ workspace: "/tmp/ws", prompt: "first" });
  await this.agent.resetSession();
  await this.agent.run({ workspace: "/tmp/ws", prompt: "second" });
  this.thirdRunOptions = vi.mocked(runBoundModule.runBoundAgent).mock.calls[1]?.[1];
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
      ioVolumes: expect.arrayContaining([
        expect.objectContaining({ container: "/agent/input", mode: "ro" }),
        expect.objectContaining({ container: "/agent/output" }),
        expect.objectContaining({ container: STOCK_SESSION_PATH }),
      ]),
    }),
  );
}

function first_run_has_no_session_id(this: Context) {
  expect(this.firstRunOptions?.sessionId).toBeUndefined();
}

function second_run_resumes_captured_session(this: Context) {
  expect(this.secondRunOptions?.sessionId).toBe(STOCK_SESSION_ID);
}

function session_volume_is_mounted(this: Context) {
  expect(this.firstRunOptions?.ioVolumes).toEqual(
    expect.arrayContaining([expect.objectContaining({ container: STOCK_SESSION_PATH })]),
  );
}

function session_id_getter_matches(this: Context) {
  expect(this.agent?.sessionId()).toBe(STOCK_SESSION_ID);
}

function third_run_has_no_session_id(this: Context) {
  expect(this.thirdRunOptions?.sessionId).toBeUndefined();
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
