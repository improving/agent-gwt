import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_ROOT } from "./package-root.js";

type Context = {
  baseDockerfile: string;
};

describe("PACKAGE_ROOT", () => {
  test("points at the package root that contains the base Dockerfile", {
    when: {
      resolving_dockerfile,
    },
    then: {
      base_dockerfile_exists,
    },
  });
});

function resolving_dockerfile(this: Context) {
  this.baseDockerfile = join(PACKAGE_ROOT, "docker", "base.Dockerfile");
}

function base_dockerfile_exists(this: Context) {
  expect(existsSync(this.baseDockerfile)).toBe(true);
}
