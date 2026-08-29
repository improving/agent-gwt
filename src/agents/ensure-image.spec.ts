import { afterEach, describe, expect } from "vitest";
import test from "vitest-gwt";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { buildDockerImage, ensureDockerImage, resetEnsuredImages } from "./ensure-image.js";
import type { DockerRunner } from "./types.js";

type Context = {
  image: string;
  packageRoot: string;
  dockerfileRelative: string;
  dockerRunner: DockerRunner;
  inspectCalls: number;
  buildCalls: number;
  error?: Error;
};

const tempRoots: string[] = [];

afterEach(async () => {
  resetEnsuredImages();
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ensureDockerImage", () => {
  test("returns when the image already exists", {
    given: {
      image_name,
      inspect_succeeds,
    },
    when: {
      ensuring_image,
    },
    then: {
      inspect_was_called,
      build_was_not_called,
    },
  });

  test("throws when the image is missing", {
    given: {
      image_name,
      inspect_fails,
    },
    when: {
      ensuring_image_catching_error,
    },
    then: {
      error_mentions_missing_image,
      build_was_not_called,
    },
  });
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

async function package_with_dockerfile(this: Context) {
  this.dockerfileRelative = join("docker", "cursor", "Dockerfile");
  this.packageRoot = await mkdtemp(join(tmpdir(), "agent-gwt-pkg-"));
  tempRoots.push(this.packageRoot);
  await mkdir(join(this.packageRoot, "docker", "cursor"), { recursive: true });
  await writeFile(join(this.packageRoot, this.dockerfileRelative), "FROM scratch\n");
}

function reset_memo() {
  resetEnsuredImages();
}

function image_name(this: Context) {
  this.image = "agent-gwt/test:local";
  this.inspectCalls = 0;
  this.buildCalls = 0;
}

function inspect_succeeds(this: Context) {
  this.dockerRunner = async (args) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      return { exitCode: 0, stdout: "[]", stderr: "" };
    }
    throw new Error(`unexpected docker args: ${args.join(" ")}`);
  };
}

function inspect_fails(this: Context) {
  this.dockerRunner = async (args) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      return { exitCode: 1, stdout: "", stderr: "No such image" };
    }
    if (args[0] === "build") {
      this.buildCalls += 1;
      return { exitCode: 0, stdout: "done", stderr: "" };
    }
    throw new Error(`unexpected docker args: ${args.join(" ")}`);
  };
}

function inspect_fails_then_build_succeeds(this: Context) {
  this.dockerRunner = async (args) => {
    if (args[0] === "image" && args[1] === "inspect") {
      this.inspectCalls += 1;
      return { exitCode: 1, stdout: "", stderr: "No such image" };
    }
    if (args[0] === "build") {
      this.buildCalls += 1;
      return { exitCode: 0, stdout: "done", stderr: "" };
    }
    throw new Error(`unexpected docker args: ${args.join(" ")}`);
  };
}

function inspect_fails_then_build_fails(this: Context) {
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

async function ensuring_image(this: Context) {
  await ensureDockerImage(this.image, {
    dockerRunner: this.dockerRunner,
  });
}

async function ensuring_image_catching_error(this: Context) {
  try {
    await ensuring_image.call(this);
  } catch (error) {
    this.error = error as Error;
  }
}

async function building_image(this: Context) {
  await buildDockerImage(this.image, {
    dockerfileRelative: this.dockerfileRelative,
    packageRoot: this.packageRoot,
    dockerRunner: this.dockerRunner,
  });
}

async function building_image_twice(this: Context) {
  await building_image.call(this);
  await building_image.call(this);
}

async function building_image_catching_error(this: Context) {
  try {
    await building_image.call(this);
  } catch (error) {
    this.error = error as Error;
  }
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

function error_mentions_missing_image(this: Context) {
  expect(this.error?.message).toContain("agent-gwt/test:local");
  expect(this.error?.message).toContain("buildAgentImage");
}

function error_mentions_failed_build(this: Context) {
  expect(this.error?.message).toContain("Failed to build image");
  expect(this.error?.message).toContain("build boom");
}
