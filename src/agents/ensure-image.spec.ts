import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { ensureDockerImage } from "./ensure-image.js";
import type { DockerRunner } from "./types.js";

type Context = {
  image: string;
  dockerRunner: DockerRunner;
  inspectCalls: number;
  buildCalls: number;
  error?: Error;
};

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

function inspect_was_called(this: Context) {
  expect(this.inspectCalls).toBe(1);
}

function build_was_not_called(this: Context) {
  expect(this.buildCalls).toBe(0);
}

function error_mentions_missing_image(this: Context) {
  expect(this.error?.message).toContain("agent-gwt/test:local");
  expect(this.error?.message).toContain("buildAgentImage");
}
