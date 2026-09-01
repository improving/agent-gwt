import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { join } from "node:path";

import { runCursorInDocker } from "./run.js";
import type { DockerRunner } from "../types.js";

type Context = {
  result: unknown;
  dockerRunner: DockerRunner;
  authFile: string;
};

describe("runCursorInDocker", () => {
  test("parses JSON from a successful docker run", {
    given: {
      successful_docker_runner,
      existing_auth_file,
    },
    when: {
      running_cursor_in_docker,
    },
    then: {
      agent_result_is_parsed,
    },
  });

  test("throws when docker exits non-zero", {
    given: {
      failing_docker_runner,
      existing_auth_file,
    },
    when: {
      running_cursor_in_docker,
    },
    then: {
      expect_error: error_includes_exit_code,
    },
  });
});

function successful_docker_runner(this: Context) {
  this.dockerRunner = async () => ({
    exitCode: 0,
    stdout: '{"ok":true}',
    stderr: "",
  });
}

function failing_docker_runner(this: Context) {
  this.dockerRunner = async () => ({
    exitCode: 1,
    stdout: "",
    stderr: "boom",
  });
}

function existing_auth_file(this: Context) {
  this.authFile = join(process.cwd(), "package.json");
}

async function running_cursor_in_docker(this: Context) {
  this.result = await runCursorInDocker(
    {
      workspace: "/tmp/.agents-gwt/ws-abc",
      prompt: "hi",
      image: "clanker-cleanroom/cursor",
      authFile: this.authFile,
      uid: 1000,
      gid: 1000,
    },
    this.dockerRunner,
  );
}

function agent_result_is_parsed(this: Context) {
  expect(this.result).toEqual({ ok: true });
}

function error_includes_exit_code(this: Context, error: Error) {
  expect(error.message).toContain("exited with code 1");
}
