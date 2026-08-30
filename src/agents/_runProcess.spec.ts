import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { runProcess } from "./_runProcess.js";
import type { DockerRunResult } from "./types.js";

type Context = {
  result: DockerRunResult;
  controller: AbortController;
  abortCalls: number;
};

const ECHO_STDIN =
  "process.stdin.on('data', (d) => process.stdout.write(d)); process.stdin.on('end', () => process.exit(0));";
const HANG = "setTimeout(() => {}, 30_000);";

describe("runProcess", () => {
  test("feeds stdin to the process and captures its output", {
    when: {
      running_an_echo_process_with_stdin,
    },
    then: {
      stdout_is_the_stdin,
      exit_code_is_zero,
    },
  });

  test("kills the process, runs onAbort, and rejects when the signal aborts", {
    given: {
      a_controller_that_aborts_shortly,
    },
    when: {
      running_a_hanging_process,
    },
    then: {
      expect_error: error_says_cancelled_and_on_abort_ran,
    },
  });

  test("rejects at once when the signal is already aborted", {
    given: {
      an_already_aborted_controller,
    },
    when: {
      running_a_hanging_process,
    },
    then: {
      expect_error: error_says_cancelled_with_the_reason,
    },
  });
});

async function running_an_echo_process_with_stdin(this: Context) {
  this.result = await runProcess(process.execPath, ["-e", ECHO_STDIN], { stdin: "hello, stdin" });
}

function stdout_is_the_stdin(this: Context) {
  expect(this.result.stdout).toBe("hello, stdin");
}

function exit_code_is_zero(this: Context) {
  expect(this.result.exitCode).toBe(0);
}

function a_controller_that_aborts_shortly(this: Context) {
  this.controller = new AbortController();
  this.abortCalls = 0;
  setTimeout(() => this.controller.abort(new Error("took too long")), 10);
}

function an_already_aborted_controller(this: Context) {
  this.controller = new AbortController();
  this.abortCalls = 0;
  this.controller.abort(new Error("took too long"));
}

async function running_a_hanging_process(this: Context) {
  await runProcess(process.execPath, ["-e", HANG], {
    signal: this.controller.signal,
    onAbort: () => {
      this.abortCalls += 1;
    },
  });
}

function error_says_cancelled_with_the_reason(this: Context, error: Error) {
  expect(error.message).toContain("run cancelled: took too long");
}

function error_says_cancelled_and_on_abort_ran(this: Context, error: Error) {
  error_says_cancelled_with_the_reason.call(this, error);
  expect(this.abortCalls).toBe(1);
}
