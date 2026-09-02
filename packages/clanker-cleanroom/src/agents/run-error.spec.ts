import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { agentRunError } from "./run-error.js";

type Context = {
  error: Error;
};

describe("agentRunError", () => {
  test("names the agent and exit code and dumps both streams", {
    when: {
      building_error_for_generic_failure,
    },
    then: {
      message_has_headline,
      message_has_streams,
      message_has_no_build_hint,
    },
  });

  test("adds a build hint when docker cannot find the image", {
    when: {
      building_error_for_missing_image,
    },
    then: {
      message_has_build_hint,
    },
  });

  test("puts the agent-reported detail in the headline", {
    when: {
      building_error_with_detail,
    },
    then: {
      message_has_detail_headline,
    },
  });
});

function building_error_for_generic_failure(this: Context) {
  this.error = agentRunError({
    agent: "Cursor",
    image: "clanker-cleanroom/cursor",
    result: { exitCode: 2, stdout: "out", stderr: "boom" },
  });
}

function building_error_for_missing_image(this: Context) {
  this.error = agentRunError({
    agent: "Claude",
    image: "clanker-cleanroom/claude",
    result: {
      exitCode: 125,
      stdout: "",
      stderr: "Unable to find image 'clanker-cleanroom/claude' locally",
    },
  });
}

function building_error_with_detail(this: Context) {
  this.error = agentRunError({
    agent: "Claude",
    image: "clanker-cleanroom/claude",
    result: { exitCode: 1, stdout: "{}", stderr: "" },
    detail: "api_error: Not logged in",
  });
}

function message_has_headline(this: Context) {
  expect(this.error.message).toContain("Cursor agent exited with code 2.");
}

function message_has_streams(this: Context) {
  expect(this.error.message).toContain("stderr:\nboom");
  expect(this.error.message).toContain("stdout:\nout");
}

function message_has_no_build_hint(this: Context) {
  expect(this.error.message.includes("buildImages")).toBe(false);
}

function message_has_build_hint(this: Context) {
  expect(this.error.message).toContain("buildImages()");
  expect(this.error.message).toContain("clanker-cleanroom/claude");
}

function message_has_detail_headline(this: Context) {
  expect(this.error.message).toContain("Claude agent exited with code 1: api_error: Not logged in");
}
