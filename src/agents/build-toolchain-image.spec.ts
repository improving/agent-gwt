import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import * as buildAgentImageModule from "./build-agent-image.js";
import {
  buildToolchainImage,
  clearToolchainImageMemory,
  resetToolchainImages,
  resolveToolchainImage,
} from "./build-toolchain-image.js";
import { resetBuiltImages } from "./build-agent-image.js";
import type { DockerRunOptions, DockerRunner } from "./types.js";

type Context = {
  variant: string;
  packageRoot: string;
  dockerfileRelative: string;
  dockerfileContents: string;
  dockerRunner: DockerRunner;
  inspectCalls: number;
  buildCalls: number;
  lastInspectImage: string | undefined;
  lastBuildArgs: string[] | undefined;
  lastBuildOptions: DockerRunOptions | undefined;
  error: Error | undefined;
  agentBuildCalls: number;
  firstImage: string | undefined;
  secondImage: string | undefined;
};

const tempRoots: string[] = [];

afterEach(async () => {
  resetToolchainImages();
  resetBuiltImages();
  vi.restoreAllMocks();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("buildToolchainImage", () => {
  test("builds a content-hashed tag and registers the variant", {
    given: {
      reset_state,
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_fails_then_build_succeeds,
    },
    when: {
      building_toolchain,
    },
    then: {
      agent_image_was_built,
      inspect_was_called,
      build_was_called,
      build_targeted_hashed_image,
      variant_is_registered,
    },
  });

  test("skips docker build when the hashed image already exists", {
    given: {
      reset_state,
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_succeeds,
    },
    when: {
      building_toolchain,
    },
    then: {
      inspect_was_called,
      build_was_not_called,
      variant_is_registered,
    },
  });

  test("memoizes so a second build does not re-inspect", {
    given: {
      reset_state,
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_succeeds,
    },
    when: {
      building_toolchain_twice,
    },
    then: {
      inspect_called_once,
      build_was_not_called,
    },
  });

  test("uses a new tag when the Dockerfile content changes", {
    given: {
      reset_state,
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_fails_then_build_succeeds,
    },
    when: {
      building_then_changing_dockerfile_and_rebuilding,
    },
    then: {
      rebuilt_with_new_content_digest,
    },
  });

  test("scopes tags by package root so repos do not collide", {
    given: {
      reset_state,
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_fails_then_build_succeeds,
    },
    when: {
      building_same_dockerfile_in_two_roots,
    },
    then: {
      tags_differ_by_repo_digest,
    },
  });

  test("surfaces a clear error when the Dockerfile is missing", {
    given: {
      reset_state,
      variant_name,
      package_without_dockerfile,
      stub_agent_build,
    },
    when: {
      building_toolchain_catching_error,
    },
    then: {
      error_mentions_missing_dockerfile,
    },
  });

  test("resolves a variant from the persisted registry after memory is cleared", {
    given: {
      reset_state,
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_succeeds,
    },
    when: {
      building_then_clearing_memory_and_resolving,
    },
    then: {
      variant_resolved_from_disk,
    },
  });
});

function reset_state() {
  resetToolchainImages();
  resetBuiltImages();
}

function variant_name(this: Context) {
  this.variant = "node18";
  this.inspectCalls = 0;
  this.buildCalls = 0;
  this.agentBuildCalls = 0;
  this.dockerfileRelative = join("docker", "agent.Dockerfile");
  this.dockerfileContents = "FROM agent-gwt/cursor-cli:local\n";
}

async function package_with_dockerfile(this: Context) {
  this.packageRoot = await mkdtemp(join(tmpdir(), "agent-gwt-tc-"));
  tempRoots.push(this.packageRoot);
  await mkdir(join(this.packageRoot, "docker"), { recursive: true });
  await writeFile(join(this.packageRoot, this.dockerfileRelative), this.dockerfileContents);
}

async function package_without_dockerfile(this: Context) {
  this.packageRoot = await mkdtemp(join(tmpdir(), "agent-gwt-tc-missing-"));
  tempRoots.push(this.packageRoot);
  this.dockerfileRelative = join("docker", "missing.Dockerfile");
}

function stub_agent_build(this: Context) {
  vi.spyOn(buildAgentImageModule, "buildAgentImage").mockImplementation(async () => {
    this.agentBuildCalls += 1;
  });
}

function inspect_succeeds(this: Context) {
  this.dockerRunner = async (args) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      this.lastInspectImage = args[2];
      return { exitCode: 0, stdout: "[]", stderr: "" };
    }
    throw new Error(`unexpected docker args: ${args.join(" ")}`);
  };
}

function inspect_fails_then_build_succeeds(this: Context) {
  this.dockerRunner = async (args, options) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      this.lastInspectImage = args[2];
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

async function building_toolchain(this: Context) {
  await buildToolchainImage(this.variant, {
    agent: "cursor",
    dockerfileRelative: this.dockerfileRelative,
    packageRoot: this.packageRoot,
    dockerRunner: this.dockerRunner,
  });
}

async function building_toolchain_twice(this: Context) {
  await building_toolchain.call(this);
  await building_toolchain.call(this);
}

async function building_toolchain_catching_error(this: Context) {
  try {
    await buildToolchainImage(this.variant, {
      agent: "cursor",
      dockerfileRelative: this.dockerfileRelative,
      packageRoot: this.packageRoot,
    });
  } catch (error) {
    this.error = error as Error;
  }
}

async function building_then_changing_dockerfile_and_rebuilding(this: Context) {
  await building_toolchain.call(this);
  this.firstImage = resolveToolchainImage("cursor", this.variant);

  this.dockerfileContents = "FROM agent-gwt/cursor-cli:local\nRUN echo changed\n";
  await writeFile(join(this.packageRoot, this.dockerfileRelative), this.dockerfileContents);
  resetBuiltImages();
  this.buildCalls = 0;
  this.inspectCalls = 0;

  await building_toolchain.call(this);
  this.secondImage = resolveToolchainImage("cursor", this.variant);
}

async function building_same_dockerfile_in_two_roots(this: Context) {
  await building_toolchain.call(this);
  this.firstImage = resolveToolchainImage("cursor", this.variant);

  const secondRoot = await mkdtemp(join(tmpdir(), "agent-gwt-tc-other-"));
  tempRoots.push(secondRoot);
  await mkdir(join(secondRoot, "docker"), { recursive: true });
  await writeFile(join(secondRoot, this.dockerfileRelative), this.dockerfileContents);

  resetBuiltImages();
  this.packageRoot = secondRoot;
  await building_toolchain.call(this);
  this.secondImage = resolveToolchainImage("cursor", this.variant);
}

async function building_then_clearing_memory_and_resolving(this: Context) {
  await building_toolchain.call(this);
  this.firstImage = resolveToolchainImage("cursor", this.variant);
  clearToolchainImageMemory();
  this.secondImage = resolveToolchainImage("cursor", this.variant);
}

function variant_resolved_from_disk(this: Context) {
  expect(this.firstImage).toBeDefined();
  expect(this.secondImage).toBe(this.firstImage);
}

function agent_image_was_built(this: Context) {
  expect(this.agentBuildCalls).toBe(1);
  expect(buildAgentImageModule.buildAgentImage).toHaveBeenCalledWith("cursor");
}

function inspect_was_called(this: Context) {
  expect(this.inspectCalls).toBe(1);
}

function inspect_called_once(this: Context) {
  expect(this.inspectCalls).toBe(1);
}

function build_was_called(this: Context) {
  expect(this.buildCalls).toBe(1);
}

function build_was_not_called(this: Context) {
  expect(this.buildCalls).toBe(0);
}

function build_targeted_hashed_image(this: Context) {
  const expected = expectedImage(this.packageRoot, this.dockerfileContents);
  expect(this.lastInspectImage).toBe(expected);
  expect(this.lastBuildArgs).toEqual([
    "build",
    "--progress=plain",
    "-t",
    expected,
    "-f",
    join(this.packageRoot, this.dockerfileRelative),
    this.packageRoot,
  ]);
  expect(this.lastBuildOptions).toEqual({ inheritOutput: true });
}

function variant_is_registered(this: Context) {
  expect(resolveToolchainImage("cursor", this.variant)).toBe(
    expectedImage(this.packageRoot, this.dockerfileContents),
  );
}

function rebuilt_with_new_content_digest(this: Context) {
  expect(this.firstImage).toBeDefined();
  expect(this.secondImage).toBeDefined();
  expect(this.firstImage).not.toBe(this.secondImage);
  expect(tagOf(this.secondImage!)).toBe(contentDigestOf(this.dockerfileContents));
  expect(this.buildCalls).toBe(1);
}

function tags_differ_by_repo_digest(this: Context) {
  expect(this.firstImage).toBeDefined();
  expect(this.secondImage).toBeDefined();
  expect(this.firstImage).not.toBe(this.secondImage);
  expect(repoDigestOf(this.firstImage!)).not.toBe(repoDigestOf(this.secondImage!));
  expect(tagOf(this.firstImage!)).toBe(tagOf(this.secondImage!));
}

function error_mentions_missing_dockerfile(this: Context) {
  expect(this.error?.message).toContain("Dockerfile not found");
  expect(this.error?.message).toContain(join(this.packageRoot, this.dockerfileRelative));
}

function expectedImage(packageRoot: string, contents: string): string {
  const repoDigest = createHash("sha256").update(resolve(packageRoot)).digest("hex").slice(0, 12);
  const contentDigest = contentDigestOf(contents);
  return `agent-gwt/toolchain-cursor-${repoDigest}:${contentDigest}`;
}

function contentDigestOf(contents: string): string {
  return createHash("sha256").update(contents).digest("hex").slice(0, 12);
}

function tagOf(image: string): string {
  return image.slice(image.lastIndexOf(":") + 1);
}

function repoDigestOf(image: string): string {
  const name = image.slice(0, image.lastIndexOf(":"));
  return name.slice(name.lastIndexOf("-") + 1);
}
