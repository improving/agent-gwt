import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect } from "vitest";
import test, { withAspect } from "vitest-gwt";

import { AgentFs } from "./agent-fs.js";

type Context = {
  tmpDir: string;
  fs: AgentFs;
  text?: string;
  bytes?: Buffer;
  listed?: string[];
  error?: Error;
};

describe("AgentFs", () => {
  withAspect(
    async function (this: Context) {
      this.tmpDir = await mkdtemp(join(tmpdir(), "agent-fs-test-"));
      this.fs = new AgentFs("/agent/input", { tmpDir: this.tmpDir });
    },
    async function (this: Context) {
      await rm(this.tmpDir, { recursive: true, force: true });
    },
  );

  test("writes, reads, and lists nested files", {
    when: {
      writing_nested_files,
      reading_and_listing,
    },
    then: {
      text_and_bytes_match,
      list_includes_both_files,
    },
  });

  test("clear removes contents but keeps the root usable", {
    given: {
      nested_file_written,
    },
    when: {
      clearing_then_listing,
    },
    then: {
      list_is_empty,
    },
  });

  test("rejects path escape", {
    when: {
      writing_parent_escape_catching,
    },
    then: {
      error_mentions_unsafe_path,
    },
  });
});

async function writing_nested_files(this: Context) {
  await this.fs.write("dir/a.txt", "hello");
  await this.fs.write("bin/data.bin", new Uint8Array([1, 2, 3]));
}

async function reading_and_listing(this: Context) {
  this.text = await this.fs.readText("dir/a.txt");
  this.bytes = await this.fs.read("bin/data.bin");
  this.listed = await this.fs.list();
}

async function nested_file_written(this: Context) {
  await this.fs.write("keep/me.txt", "x");
}

async function clearing_then_listing(this: Context) {
  await this.fs.clear();
  this.listed = await this.fs.list();
}

async function writing_parent_escape_catching(this: Context) {
  try {
    await this.fs.write("../escape.txt", "nope");
  } catch (error) {
    this.error = error as Error;
  }
}

function text_and_bytes_match(this: Context) {
  expect(this.text).toBe("hello");
  expect(this.bytes).toEqual(Buffer.from([1, 2, 3]));
}

function list_includes_both_files(this: Context) {
  expect(this.listed).toEqual(["bin/data.bin", "dir/a.txt"]);
}

function list_is_empty(this: Context) {
  expect(this.listed).toEqual([]);
}

function error_mentions_unsafe_path(this: Context) {
  expect(this.error?.message).toContain("not a safe relative path");
}
