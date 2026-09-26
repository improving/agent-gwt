import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { runDocker } from "clanker-cleanroom";

import { DEVIN_IMAGE } from "./constants.js";

type Context = {
  result?: Awaited<ReturnType<typeof runDocker>>;
};

async function dockerUp(): Promise<boolean> {
  try {
    const info = await runDocker(["info"]);
    return info.exitCode === 0;
  } catch {
    return false;
  }
}

async function imagePresent(): Promise<boolean> {
  const inspect = await runDocker(["image", "inspect", DEVIN_IMAGE]);
  return inspect.exitCode === 0;
}

const canRunSmoke = (await dockerUp()) && (await imagePresent());

// Smoke test: runs the real container. Skips when Docker is unavailable or the
// image has not been built yet (build it with `buildImages({ dir: DOCKER_DIR })`
// or via the agent-gwt e2e globalSetup).
describe.skipIf(!canRunSmoke)("devin docker image smoke", () => {
  test("container runs devin --version successfully", {
    given: {
      the_built_devin_image,
    },
    when: {
      running_devin_version_in_a_container,
    },
    then: {
      the_container_exits_cleanly_and_prints_a_version,
    },
  });
});

function the_built_devin_image(this: Context) {
  /* the image was verified present before this suite ran */
}

async function running_devin_version_in_a_container(this: Context) {
  this.result = await runDocker([
    "run",
    "--rm",
    "--user",
    `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`,
    "-e",
    "HOME=/home/agent",
    DEVIN_IMAGE,
    "devin",
    "--version",
  ]);
}

function the_container_exits_cleanly_and_prints_a_version(this: Context) {
  expect(this.result?.exitCode).toBe(0);
  expect(this.result?.stdout).toMatch(/devin/i);
}
