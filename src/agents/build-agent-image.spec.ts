import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildAgentImage,
  buildBaseImage,
  buildDockerImage,
  resetBuiltImages,
} from "./build-agent-image.js";
import { BASE_DOCKERFILE_RELATIVE, BASE_IMAGE } from "./base/constants.js";
import { agentRegistry, type AgentName } from "./registry.js";
import type { DockerRunOptions, DockerRunner } from "./types.js";

type BuildContext = {
  image: string;
  packageRoot: string;
  dockerfileRelative: string;
  dockerRunner: DockerRunner;
  inspectCalls: number;
  buildCalls: number;
  lastBuildArgs?: string[];
  lastBuildOptions?: DockerRunOptions;
  error?: Error;
};

type AgentBuildContext = {
  buildCalls: number;
};

const tempRoots: string[] = [];

afterEach(async () => {
  resetBuiltImages();
  vi.restoreAllMocks();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("buildDockerImage", () => {
  test("skips build when the image already exists", {
    given: {
      reset_memo,
      image_name,
      package_with_dockerfile,
      inspect_succeeds,
    },
    when: {
      building_image,
    },
    then: {
      inspect_was_called,
      build_was_not_called,
    },
  });

  test("builds the image when inspect fails", {
    given: {
      reset_memo,
      image_name,
      package_with_dockerfile,
      inspect_fails_then_build_succeeds,
    },
    when: {
      building_image,
    },
    then: {
      inspect_was_called,
      build_was_called,
      build_uses_plain_progress_and_streams_output,
    },
  });

  test("memoizes so a second build does not re-inspect", {
    given: {
      reset_memo,
      image_name,
      package_with_dockerfile,
      inspect_succeeds,
    },
    when: {
      building_image_twice,
    },
    then: {
      inspect_called_once,
      build_was_not_called,
    },
  });

  test("surfaces a clear error when build fails", {
    given: {
      reset_memo,
      image_name,
      package_with_dockerfile,
      inspect_fails_then_build_fails,
    },
    when: {
      building_image_catching_error,
    },
    then: {
      error_mentions_failed_build,
    },
  });
});

describe("buildBaseImage", () => {
  test("builds the shared base image from the package root", {
    given: {
      reset_memo,
      package_with_base_dockerfile,
      inspect_fails_then_build_succeeds,
    },
    when: {
      building_base_image,
    },
    then: {
      inspect_was_called,
      build_was_called,
      build_targeted_base_image,
    },
  });
});

describe("buildAgentImage", () => {
  test("delegates to the resolved agent's buildImage", {
    given: {
      stub_agent_build_image: stub_agent_build_image("cursor"),
    },
    when: {
      building_agent_image: building_agent_image("cursor"),
    },
    then: {
      agent_build_was_called: agent_build_was_called("cursor"),
    },
  });

  test("delegates to the claude agent's buildImage", {
    given: {
      stub_agent_build_image: stub_agent_build_image("claude"),
    },
    when: {
      building_agent_image: building_agent_image("claude"),
    },
    then: {
      agent_build_was_called: agent_build_was_called("claude"),
    },
  });
});

async function package_with_dockerfile(this: BuildContext) {
  this.dockerfileRelative = join("docker", "cursor", "Dockerfile");
  this.packageRoot = await mkdtemp(join(tmpdir(), "agent-gwt-pkg-"));
  tempRoots.push(this.packageRoot);
  await mkdir(join(this.packageRoot, "docker", "cursor"), { recursive: true });
  await writeFile(join(this.packageRoot, this.dockerfileRelative), "FROM scratch\n");
}

async function package_with_base_dockerfile(this: BuildContext) {
  this.image = BASE_IMAGE;
  this.dockerfileRelative = BASE_DOCKERFILE_RELATIVE;
  this.packageRoot = await mkdtemp(join(tmpdir(), "agent-gwt-pkg-"));
  tempRoots.push(this.packageRoot);
  this.inspectCalls = 0;
  this.buildCalls = 0;
  await mkdir(join(this.packageRoot, "docker", "base"), { recursive: true });
  await writeFile(join(this.packageRoot, this.dockerfileRelative), "FROM scratch\n");
}

async function building_base_image(this: BuildContext) {
  await buildBaseImage({
    packageRoot: this.packageRoot,
    dockerRunner: this.dockerRunner,
  });
}

function build_targeted_base_image(this: BuildContext) {
  expect(this.lastBuildArgs).toEqual([
    "build",
    "--progress=plain",
    "-t",
    BASE_IMAGE,
    "-f",
    join(this.packageRoot, BASE_DOCKERFILE_RELATIVE),
    this.packageRoot,
  ]);
}

function reset_memo() {
  resetBuiltImages();
}

function image_name(this: BuildContext) {
  this.image = "agent-gwt/test:local";
  this.inspectCalls = 0;
  this.buildCalls = 0;
}

function inspect_succeeds(this: BuildContext) {
  this.dockerRunner = async (args) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      return { exitCode: 0, stdout: "[]", stderr: "" };
    }
    throw new Error(`unexpected docker args: ${args.join(" ")}`);
  };
}

function inspect_fails_then_build_succeeds(this: BuildContext) {
  this.dockerRunner = async (args, options) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      return { exitCode: 1, stdout: "", stderr: "No such image" };
    }
    if (args[0] === "build") {
      this.buildCalls += 1;
      this.lastBuildArgs = args;
      if (options !== undefined) {
        this.lastBuildOptions = options;
      }
      return { exitCode: 0, stdout: "done", stderr: "" };
    }
    throw new Error(`unexpected docker args: ${args.join(" ")}`);
  };
}

function inspect_fails_then_build_fails(this: BuildContext) {
  this.dockerRunner = async (args) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      return { exitCode: 1, stdout: "", stderr: "No such image" };
    }
    if (args[0] === "build") {
      this.buildCalls += 1;
      return { exitCode: 1, stdout: "", stderr: "build boom" };
    }
    throw new Error(`unexpected docker args: ${args.join(" ")}`);
  };
}

async function building_image(this: BuildContext) {
  await buildDockerImage(this.image, {
    dockerfileRelative: this.dockerfileRelative,
    packageRoot: this.packageRoot,
    dockerRunner: this.dockerRunner,
  });
}

async function building_image_twice(this: BuildContext) {
  await building_image.call(this);
  await building_image.call(this);
}

async function building_image_catching_error(this: BuildContext) {
  try {
    await building_image.call(this);
  } catch (error) {
    this.error = error as Error;
  }
}

function inspect_was_called(this: BuildContext) {
  expect(this.inspectCalls).toBe(1);
}

function inspect_called_once(this: BuildContext) {
  expect(this.inspectCalls).toBe(1);
}

function build_was_called(this: BuildContext) {
  expect(this.buildCalls).toBe(1);
}

function build_was_not_called(this: BuildContext) {
  expect(this.buildCalls).toBe(0);
}

function build_uses_plain_progress_and_streams_output(this: BuildContext) {
  expect(this.lastBuildArgs).toContain("--progress=plain");
  expect(this.lastBuildOptions).toEqual({ inheritOutput: true });
}

function error_mentions_failed_build(this: BuildContext) {
  expect(this.error?.message).toContain("Failed to build image");
  expect(this.error?.message).toContain("build boom");
}

function stub_agent_build_image(name: AgentName) {
  return function (this: AgentBuildContext) {
    this.buildCalls = 0;
    vi.spyOn(agentRegistry[name], "buildImage").mockImplementation(async () => {
      this.buildCalls += 1;
    });
  };
}

function building_agent_image(name: AgentName) {
  return async () => {
    await buildAgentImage(name);
  };
}

function agent_build_was_called(name: AgentName) {
  return function (this: AgentBuildContext) {
    expect(this.buildCalls).toBe(1);
    expect(agentRegistry[name].buildImage).toHaveBeenCalledWith();
  };
}
