import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_ROOT } from "./package-root.js";

type Context = {
  baseDockerfile: string;
  cursorDockerfile: string;
};

describe("PACKAGE_ROOT", () => {
  test("points at the package root that contains the base and Cursor Dockerfiles", {
    when: {
      resolving_dockerfiles,
    },
    then: {
      base_dockerfile_exists,
      cursor_dockerfile_exists,
    },
  });
});

function resolving_dockerfiles(this: Context) {
  this.baseDockerfile = join(PACKAGE_ROOT, "docker", "base", "Dockerfile");
  this.cursorDockerfile = join(PACKAGE_ROOT, "docker", "cursor", "Dockerfile");
}

function base_dockerfile_exists(this: Context) {
  expect(existsSync(this.baseDockerfile)).toBe(true);
}

function cursor_dockerfile_exists(this: Context) {
  expect(existsSync(this.cursorDockerfile)).toBe(true);
}
