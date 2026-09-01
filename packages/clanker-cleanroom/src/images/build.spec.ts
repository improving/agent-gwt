import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect } from "vitest";
import test from "vitest-gwt";

import type { DockerRunner } from "../agents/types.js";
import { buildImages, resetBuildMemo } from "./build.js";
import { readRegistry, resetRegistry, upsertRegistryEntry } from "./registry.js";

type Context = {
  dir: string;
  packageRoot: string;
  dockerRunner: DockerRunner;
  buildTags: string[];
  error?: Error;
};

describe("buildImages", () => {
  test("builds in dependency order and writes the registry with agent", {
    given: {
      dockerfile_folder,
      docker_runner_that_builds,
    },
    when: {
      building_images,
    },
    then: {
      built_base_then_cursor,
      registry_lists_base_without_agent,
      registry_lists_cursor_with_agent,
    },
  });

  test("records agent on toolchain FROM stock cursor", {
    given: {
      toolchain_from_cursor_folder,
      docker_runner_that_builds,
      stock_cursor_already_in_registry,
    },
    when: {
      building_images,
    },
    then: {
      registry_toolchain_has_cursor_agent,
    },
  });

  test("inherits agent through a nested local toolchain", {
    given: {
      nested_toolchain_folder,
      docker_runner_that_builds,
    },
    when: {
      building_images,
    },
    then: {
      nested_toolchain_has_cursor_agent,
    },
  });

  test("skips rebuild when registry and image already exist", {
    given: {
      dockerfile_folder,
      docker_runner_that_inspects,
      prior_registry_entry,
    },
    when: {
      building_images,
    },
    then: {
      did_not_build,
    },
  });
});

function dockerfile_folder(this: Context) {
  resetBuildMemo();
  this.dir = mkdtempSync(join(tmpdir(), "clanker-build-"));
  this.packageRoot = mkdtempSync(join(tmpdir(), "clanker-root-"));
  resetRegistry({ packageRoot: this.packageRoot });
  writeFileSync(
    join(this.dir, "base.Dockerfile"),
    "# clanker-cleanroom/base\nFROM archlinux:latest\n",
  );
  writeFileSync(
    join(this.dir, "cursor.Dockerfile"),
    "# clanker-cleanroom/cursor\nFROM clanker-cleanroom/base\n",
  );
  this.buildTags = [];
}

function toolchain_from_cursor_folder(this: Context) {
  resetBuildMemo();
  this.dir = mkdtempSync(join(tmpdir(), "clanker-build-"));
  this.packageRoot = mkdtempSync(join(tmpdir(), "clanker-root-"));
  resetRegistry({ packageRoot: this.packageRoot });
  writeFileSync(
    join(this.dir, "node.Dockerfile"),
    "# cursor:node\nFROM clanker-cleanroom/cursor\n",
  );
  this.buildTags = [];
}

function nested_toolchain_folder(this: Context) {
  resetBuildMemo();
  this.dir = mkdtempSync(join(tmpdir(), "clanker-build-"));
  this.packageRoot = mkdtempSync(join(tmpdir(), "clanker-root-"));
  resetRegistry({ packageRoot: this.packageRoot });
  writeFileSync(
    join(this.dir, "base.Dockerfile"),
    "# clanker-cleanroom/base\nFROM archlinux:latest\n",
  );
  writeFileSync(
    join(this.dir, "cursor.Dockerfile"),
    "# clanker-cleanroom/cursor\nFROM clanker-cleanroom/base\n",
  );
  writeFileSync(
    join(this.dir, "node.Dockerfile"),
    "# cursor:node\nFROM clanker-cleanroom/cursor\n",
  );
  writeFileSync(
    join(this.dir, "node-git.Dockerfile"),
    "# cursor:node-git\nFROM cursor:node\n",
  );
  this.buildTags = [];
}

function stock_cursor_already_in_registry(this: Context) {
  upsertRegistryEntry(
    "clanker-cleanroom/cursor",
    {
      image: "clanker-cleanroom/cursor",
      dockerfile: "cursor.Dockerfile",
      builtAt: new Date().toISOString(),
      agent: "cursor",
    },
    { packageRoot: this.packageRoot },
  );
}

function docker_runner_that_builds(this: Context) {
  this.dockerRunner = async (args) => {
    if (args[0] === "image" && args[1] === "inspect") {
      return { exitCode: 1, stdout: "", stderr: "missing" };
    }
    if (args[0] === "build") {
      const tagIndex = args.indexOf("-t");
      const tag = args[tagIndex + 1];
      if (tag !== undefined) {
        this.buildTags.push(tag);
      }
      return { exitCode: 0, stdout: "ok", stderr: "" };
    }
    throw new Error(`unexpected: ${args.join(" ")}`);
  };
}

function docker_runner_that_inspects(this: Context) {
  this.dockerRunner = async (args) => {
    if (args[0] === "image" && args[1] === "inspect") {
      return { exitCode: 0, stdout: "[]", stderr: "" };
    }
    if (args[0] === "build") {
      const tagIndex = args.indexOf("-t");
      const tag = args[tagIndex + 1];
      if (tag !== undefined) {
        this.buildTags.push(tag);
      }
      return { exitCode: 0, stdout: "ok", stderr: "" };
    }
    throw new Error(`unexpected: ${args.join(" ")}`);
  };
}

function prior_registry_entry(this: Context) {
  upsertRegistryEntry(
    "clanker-cleanroom/base",
    {
      image: "clanker-cleanroom/base",
      dockerfile: "base.Dockerfile",
      builtAt: new Date().toISOString(),
    },
    { packageRoot: this.packageRoot },
  );
  upsertRegistryEntry(
    "clanker-cleanroom/cursor",
    {
      image: "clanker-cleanroom/cursor",
      dockerfile: "cursor.Dockerfile",
      builtAt: new Date().toISOString(),
      agent: "cursor",
    },
    { packageRoot: this.packageRoot },
  );
}

async function building_images(this: Context) {
  await buildImages({
    dir: this.dir,
    packageRoot: this.packageRoot,
    dockerRunner: this.dockerRunner,
  });
}

function built_base_then_cursor(this: Context) {
  expect(this.buildTags).toEqual(["clanker-cleanroom/base", "clanker-cleanroom/cursor"]);
}

function registry_lists_base_without_agent(this: Context) {
  const registry = readRegistry({ packageRoot: this.packageRoot });
  expect(registry.version).toBe(2);
  expect(registry.images["clanker-cleanroom/base"]).toEqual(
    expect.objectContaining({
      image: "clanker-cleanroom/base",
    }),
  );
  expect(registry.images["clanker-cleanroom/base"]?.agent).toBeUndefined();
}

function registry_lists_cursor_with_agent(this: Context) {
  const registry = readRegistry({ packageRoot: this.packageRoot });
  expect(registry.images["clanker-cleanroom/cursor"]?.agent).toBe("cursor");
}

function registry_toolchain_has_cursor_agent(this: Context) {
  const registry = readRegistry({ packageRoot: this.packageRoot });
  expect(registry.images["cursor:node"]?.agent).toBe("cursor");
  expect(registry.images["cursor:node"]?.image).toBe("cursor:node");
}

function nested_toolchain_has_cursor_agent(this: Context) {
  const registry = readRegistry({ packageRoot: this.packageRoot });
  expect(registry.images["cursor:node"]?.agent).toBe("cursor");
  expect(registry.images["cursor:node-git"]?.agent).toBe("cursor");
}

function did_not_build(this: Context) {
  expect(this.buildTags).toEqual([]);
}
