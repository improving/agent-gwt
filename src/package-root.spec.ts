import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_ROOT } from "./package-root.js";

type Context = {
  dockerfile: string;
};

describe("PACKAGE_ROOT", () => {
  test("points at the package root that contains the Cursor Dockerfile", {
    when: {
      resolving_cursor_dockerfile,
    },
    then: {
      dockerfile_exists,
    },
  });
});

function resolving_cursor_dockerfile(this: Context) {
  this.dockerfile = join(PACKAGE_ROOT, "docker", "cursor", "Dockerfile");
}

function dockerfile_exists(this: Context) {
  expect(existsSync(this.dockerfile)).toBe(true);
}
