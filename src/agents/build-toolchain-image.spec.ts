import { afterEach, describe, expect, vi } from "vitest";
import test, { withAspect } from "vitest-gwt";
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
  type BuildToolchainImageOptions,
} from "./build-toolchain-image.js";
import { resetBuiltImages } from "./build-agent-image.js";
import type { DockerRunOptions, DockerRunner } from "./types.js";

type Context = {
  variant: string;
  packageRoot: string;
  dockerfileRelative: string;
  dockerfileContents: string;
  parentImageId: string;
  dockerRunner: DockerRunner | undefined;
  inspectCalls: number;
  buildCalls: number;
  lastInspectArgs: string[] | undefined;
  lastBuildArgs: string[] | undefined;
  lastBuildOptions: DockerRunOptions | undefined;
  error: Error | undefined;
  agentBuildCalls: number;
  firstImage: string | undefined;
  secondImage: string | undefined;
  tempRoots: string[];
};

describe("buildToolchainImage", () => {
  withAspect(reset_toolchain_state, cleanup_temp_roots);

  test("builds a content-hashed tag and registers the variant", {
    given: {
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_parent_then_force_build,
    },
    when: {
      building_toolchain,
    },
    then: {
      agent_image_was_built,
      parent_image_was_inspected,
      build_was_called,
      build_targeted_hashed_image_with_agent_arg,
      variant_is_registered,
    },
  });

  test("force-rebuilds even when the hashed image already exists", {
    given: {
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      parent_present_and_target_present_still_builds,
    },
    when: {
      building_toolchain,
    },
    then: {
      build_was_called,
      variant_is_registered,
    },
  });

  test("memoizes the docker build so a second call does not rebuild", {
    given: {
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_parent_then_force_build,
    },
    when: {
      building_toolchain_twice,
    },
    then: {
      build_called_once,
    },
  });

  test("uses a new tag when the Dockerfile content changes", {
    given: {
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_parent_then_force_build,
    },
    when: {
      building_then_changing_dockerfile_and_rebuilding,
    },
    then: {
      rebuilt_with_new_content_digest,
    },
  });

  test("uses a new tag when the parent image id changes", {
    given: {
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_parent_then_force_build,
    },
    when: {
      building_then_changing_parent_id_and_rebuilding,
    },
    then: {
      rebuilt_with_new_parent_digest,
    },
  });

  test("scopes tags by package root so repos do not collide", {
    given: {
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_parent_then_force_build,
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

  test("rejects a Dockerfile FROM that does not match the agent image", {
    given: {
      variant_name,
      package_with_mismatched_from,
      stub_agent_build,
    },
    when: {
      building_toolchain_catching_error,
    },
    then: {
      error_mentions_from_mismatch,
    },
  });

  test("resolves a variant from the persisted registry after memory is cleared", {
    given: {
      variant_name,
      package_with_dockerfile,
      stub_agent_build,
      inspect_parent_then_force_build,
    },
    when: {
      building_then_clearing_memory_and_resolving,
    },
    then: {
      variant_resolved_from_disk,
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function reset_toolchain_state(this: Context) {
  resetToolchainImages();
  resetBuiltImages();
  this.tempRoots = [];
  this.inspectCalls = 0;
  this.buildCalls = 0;
  this.agentBuildCalls = 0;
  this.error = undefined;
  this.firstImage = undefined;
  this.secondImage = undefined;
  this.lastInspectArgs = undefined;
  this.lastBuildArgs = undefined;
  this.lastBuildOptions = undefined;
  this.parentImageId = "sha256:parent-image-id-1";
}

async function cleanup_temp_roots(this: Context) {
  const roots = [...this.tempRoots];
  resetToolchainImages();
  for (const root of roots) {
    resetToolchainImages({ packageRoot: root });
  }
  resetBuiltImages();
  await Promise.all(
    this.tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
}

function variant_name(this: Context) {
  this.variant = "node18";
  this.dockerfileRelative = join("docker", "agent.Dockerfile");
  this.dockerfileContents = "FROM agent-gwt/cursor-cli:local\n";
}

async function package_with_dockerfile(this: Context) {
  this.packageRoot = await mkdtemp(join(tmpdir(), "agent-gwt-tc-"));
  this.tempRoots.push(this.packageRoot);
  await mkdir(join(this.packageRoot, "docker"), { recursive: true });
  await writeFile(join(this.packageRoot, this.dockerfileRelative), this.dockerfileContents);
}

async function package_with_mismatched_from(this: Context) {
  this.dockerfileContents = "FROM agent-gwt/claude-code:local\n";
  await package_with_dockerfile.call(this);
}

async function package_without_dockerfile(this: Context) {
  this.packageRoot = await mkdtemp(join(tmpdir(), "agent-gwt-tc-missing-"));
  this.tempRoots.push(this.packageRoot);
  this.dockerfileRelative = join("docker", "missing.Dockerfile");
}

function stub_agent_build(this: Context) {
  vi.spyOn(buildAgentImageModule, "buildAgentImage").mockImplementation(async () => {
    this.agentBuildCalls += 1;
  });
}

function inspect_parent_then_force_build(this: Context) {
  this.dockerRunner = async (args, options) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      this.lastInspectArgs = args;
      if (args.includes("--format")) {
        return { exitCode: 0, stdout: `${this.parentImageId}\n`, stderr: "" };
      }
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

function parent_present_and_target_present_still_builds(this: Context) {
  this.dockerRunner = async (args, options) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      this.lastInspectArgs = args;
      if (args.includes("--format")) {
        return { exitCode: 0, stdout: `${this.parentImageId}\n`, stderr: "" };
      }
      // Target tag exists — force should still build.
      return { exitCode: 0, stdout: "[]", stderr: "" };
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
  const options: BuildToolchainImageOptions = {
    agent: "cursor",
    dockerfileRelative: this.dockerfileRelative,
    packageRoot: this.packageRoot,
  };
  if (this.dockerRunner !== undefined) {
    options.dockerRunner = this.dockerRunner;
  }
  await buildToolchainImage(this.variant, options);
}

async function building_toolchain_twice(this: Context) {
  await building_toolchain.call(this);
  await building_toolchain.call(this);
}

async function building_toolchain_catching_error(this: Context) {
  try {
    const options: BuildToolchainImageOptions = {
      agent: "cursor",
      dockerfileRelative: this.dockerfileRelative,
      packageRoot: this.packageRoot,
    };
    if (this.dockerRunner !== undefined) {
      options.dockerRunner = this.dockerRunner;
    }
    await buildToolchainImage(this.variant, options);
  } catch (error) {
    this.error = error as Error;
  }
}

async function building_then_changing_dockerfile_and_rebuilding(this: Context) {
  await building_toolchain.call(this);
  this.firstImage = resolveToolchainImage("cursor", this.variant, {
    packageRoot: this.packageRoot,
  });

  this.dockerfileContents = "FROM agent-gwt/cursor-cli:local\nRUN echo changed\n";
  await writeFile(join(this.packageRoot, this.dockerfileRelative), this.dockerfileContents);
  resetBuiltImages();
  this.buildCalls = 0;
  this.inspectCalls = 0;

  await building_toolchain.call(this);
  this.secondImage = resolveToolchainImage("cursor", this.variant, {
    packageRoot: this.packageRoot,
  });
}

async function building_then_changing_parent_id_and_rebuilding(this: Context) {
  await building_toolchain.call(this);
  this.firstImage = resolveToolchainImage("cursor", this.variant, {
    packageRoot: this.packageRoot,
  });

  this.parentImageId = "sha256:parent-image-id-2";
  resetBuiltImages();
  this.buildCalls = 0;
  this.inspectCalls = 0;

  await building_toolchain.call(this);
  this.secondImage = resolveToolchainImage("cursor", this.variant, {
    packageRoot: this.packageRoot,
  });
}

async function building_same_dockerfile_in_two_roots(this: Context) {
  await building_toolchain.call(this);
  this.firstImage = resolveToolchainImage("cursor", this.variant, {
    packageRoot: this.packageRoot,
  });

  const secondRoot = await mkdtemp(join(tmpdir(), "agent-gwt-tc-other-"));
  this.tempRoots.push(secondRoot);
  await mkdir(join(secondRoot, "docker"), { recursive: true });
  await writeFile(join(secondRoot, this.dockerfileRelative), this.dockerfileContents);

  resetBuiltImages();
  this.packageRoot = secondRoot;
  await building_toolchain.call(this);
  this.secondImage = resolveToolchainImage("cursor", this.variant, {
    packageRoot: this.packageRoot,
  });
}

async function building_then_clearing_memory_and_resolving(this: Context) {
  await building_toolchain.call(this);
  this.firstImage = resolveToolchainImage("cursor", this.variant, {
    packageRoot: this.packageRoot,
  });
  clearToolchainImageMemory();
  this.secondImage = resolveToolchainImage("cursor", this.variant, {
    packageRoot: this.packageRoot,
  });
}

function agent_image_was_built(this: Context) {
  expect(this.agentBuildCalls).toBe(1);
  expect(buildAgentImageModule.buildAgentImage).toHaveBeenCalledWith("cursor");
}

function parent_image_was_inspected(this: Context) {
  expect(this.inspectCalls).toBeGreaterThanOrEqual(1);
  expect(this.lastInspectArgs).toEqual([
    "image",
    "inspect",
    "--format",
    "{{.Id}}",
    "agent-gwt/cursor-cli:local",
  ]);
}

function build_was_called(this: Context) {
  expect(this.buildCalls).toBe(1);
}

function build_called_once(this: Context) {
  expect(this.buildCalls).toBe(1);
}

function build_targeted_hashed_image_with_agent_arg(this: Context) {
  const expected = expectedImage(this.packageRoot, this.dockerfileContents, this.parentImageId);
  expect(this.lastBuildArgs).toEqual([
    "build",
    "--progress=plain",
    "-t",
    expected,
    "--build-arg",
    "AGENT_IMAGE=agent-gwt/cursor-cli:local",
    "-f",
    join(this.packageRoot, this.dockerfileRelative),
    this.packageRoot,
  ]);
  expect(this.lastBuildOptions).toEqual({ inheritOutput: true });
}

function variant_is_registered(this: Context) {
  expect(resolveToolchainImage("cursor", this.variant, { packageRoot: this.packageRoot })).toBe(
    expectedImage(this.packageRoot, this.dockerfileContents, this.parentImageId),
  );
}

function rebuilt_with_new_content_digest(this: Context) {
  expect(this.firstImage).toBeDefined();
  expect(this.secondImage).toBeDefined();
  expect(this.firstImage).not.toBe(this.secondImage);
  expect(tagOf(this.secondImage!)).toBe(
    contentDigestOf(this.dockerfileContents, this.parentImageId),
  );
  expect(this.buildCalls).toBe(1);
}

function rebuilt_with_new_parent_digest(this: Context) {
  expect(this.firstImage).toBeDefined();
  expect(this.secondImage).toBeDefined();
  expect(this.firstImage).not.toBe(this.secondImage);
  expect(tagOf(this.secondImage!)).toBe(
    contentDigestOf(this.dockerfileContents, this.parentImageId),
  );
  expect(this.buildCalls).toBe(1);
}

function tags_differ_by_repo_digest(this: Context) {
  expect(this.firstImage).toBeDefined();
  expect(this.secondImage).toBeDefined();
  expect(this.firstImage).not.toBe(this.secondImage);
  expect(repoDigestOf(this.firstImage!)).not.toBe(repoDigestOf(this.secondImage!));
  expect(tagOf(this.firstImage!)).toBe(tagOf(this.secondImage!));
}

function variant_resolved_from_disk(this: Context) {
  expect(this.firstImage).toBeDefined();
  expect(this.secondImage).toBe(this.firstImage);
}

function error_mentions_missing_dockerfile(this: Context) {
  expect(this.error?.message).toContain("Dockerfile not found");
  expect(this.error?.message).toContain(join(this.packageRoot, this.dockerfileRelative));
}

function error_mentions_from_mismatch(this: Context) {
  expect(this.error?.message).toContain("Dockerfile FROM must resolve to");
  expect(this.error?.message).toContain("agent-gwt/cursor-cli:local");
}

function expectedImage(packageRoot: string, contents: string, parentId: string): string {
  const repoDigest = createHash("sha256").update(resolve(packageRoot)).digest("hex").slice(0, 12);
  const contentDigest = contentDigestOf(contents, parentId);
  return `agent-gwt/toolchain-cursor-${repoDigest}:${contentDigest}`;
}

function contentDigestOf(contents: string, parentId: string): string {
  return createHash("sha256").update(`${contents}\n${parentId}`).digest("hex").slice(0, 12);
}

function tagOf(image: string): string {
  return image.slice(image.lastIndexOf(":") + 1);
}

function repoDigestOf(image: string): string {
  const name = image.slice(0, image.lastIndexOf(":"));
  return name.slice(name.lastIndexOf("-") + 1);
}
