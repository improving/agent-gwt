import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_ROOT } from "./package-root.js";

type Context = {
  baseDockerfile: string;
  cursorDockerfile: string;
  claudeDockerfile: string;
};

describe("PACKAGE_ROOT", () => {
  test("points at the package root that contains the base, Cursor, and Claude Dockerfiles", {
    when: {
      resolving_dockerfiles,
    },
    then: {
      base_dockerfile_exists,
      cursor_dockerfile_exists,
      claude_dockerfile_exists,
    },
  });
});

function resolving_dockerfiles(this: Context) {
  this.baseDockerfile = join(PACKAGE_ROOT, "docker", "base", "Dockerfile");
  this.cursorDockerfile = join(PACKAGE_ROOT, "docker", "cursor", "Dockerfile");
  this.claudeDockerfile = join(PACKAGE_ROOT, "docker", "claude", "Dockerfile");
}

function base_dockerfile_exists(this: Context) {
  expect(existsSync(this.baseDockerfile)).toBe(true);
}

function cursor_dockerfile_exists(this: Context) {
  expect(existsSync(this.cursorDockerfile)).toBe(true);
}

function claude_dockerfile_exists(this: Context) {
  expect(existsSync(this.claudeDockerfile)).toBe(true);
}
