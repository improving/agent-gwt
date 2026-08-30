import { execFileSync } from "node:child_process";
import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { BASE_IMAGE, runDocker } from "../src/index.js";

type Context = {
  name: string;
  controller: AbortController;
  stdout: string;
};

function hasBaseImage(): boolean {
  try {
    execFileSync("docker", ["image", "inspect", BASE_IMAGE], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!hasBaseImage())("cancellation and stdin against real docker", () => {
  test("an aborted run is rejected and its container is gone", {
    given: {
      a_named_container_and_a_controller_that_aborts_shortly,
    },
    when: {
      running_a_sleeping_container,
    },
    then: {
      expect_error: run_was_cancelled_and_container_is_gone,
    },
  });

  test("a 300 KB prompt reaches the container on stdin", {
    when: {
      piping_a_large_stdin_through_wc,
    },
    then: {
      byte_count_matches,
    },
  });
});

function a_named_container_and_a_controller_that_aborts_shortly(this: Context) {
  this.name = `agent-gwt-e2e-cancel-${Date.now()}`;
  this.controller = new AbortController();
  setTimeout(() => this.controller.abort(new Error("test timeout")), 1_000);
}

async function running_a_sleeping_container(this: Context) {
  await runDocker(["run", "--rm", "--name", this.name, BASE_IMAGE, "sleep", "60"], {
    signal: this.controller.signal,
    containerName: this.name,
  });
}

async function run_was_cancelled_and_container_is_gone(this: Context, error: Error) {
  expect(error.message).toContain("docker run cancelled: test timeout");
  const listed = await runDocker([
    "ps",
    "-a",
    "--filter",
    `name=${this.name}`,
    "--format",
    "{{.Names}}",
  ]);
  expect(listed.stdout.trim()).toBe("");
}

async function piping_a_large_stdin_through_wc(this: Context) {
  const prompt = "x".repeat(300 * 1024);
  const result = await runDocker(["run", "--rm", "-i", BASE_IMAGE, "sh", "-c", "wc -c"], {
    stdin: prompt,
  });
  this.stdout = result.stdout;
}

function byte_count_matches(this: Context) {
  expect(this.stdout.trim()).toBe(String(300 * 1024));
}
