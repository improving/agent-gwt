import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { join } from "node:path";

import { runCursorInDocker } from "./run.js";
import type { DockerRunOptions, DockerRunner } from "../types.js";

type Context = {
  result: unknown;
  dockerRunner: DockerRunner;
  authFile: string;
  lastArgs: string[];
  lastRunOptions: DockerRunOptions | undefined;
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
      prompt_went_to_stdin_of_a_named_container,
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
  this.dockerRunner = async (args, options) => {
    this.lastArgs = args;
    this.lastRunOptions = options;
    return { exitCode: 0, stdout: '{"ok":true}', stderr: "" };
  };
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
      image: "agent-gwt/cursor-cli:local",
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

function prompt_went_to_stdin_of_a_named_container(this: Context) {
  expect(this.lastArgs).not.toContain("hi");
  expect(this.lastRunOptions?.stdin).toBe("hi");
  expect(this.lastRunOptions?.containerName).toMatch(/^agent-gwt-cursor-[0-9a-f]{8}$/);
  expect(this.lastArgs[this.lastArgs.indexOf("--name") + 1]).toBe(
    this.lastRunOptions?.containerName,
  );
}
