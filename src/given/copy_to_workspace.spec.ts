import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect } from "vitest";
import { test, withAspect } from "vitest-gwt";

import { copy_to_workspace, type CopyToWorkspaceOptions } from "./copy_to_workspace.js";

type Context = {
  sourceRoot: string;
  workspace: string;
  globs: string[];
  options: CopyToWorkspaceOptions;
};

describe("copy_to_workspace", () => {
  withAspect(setup_temp_dirs, cleanup_temp_dirs);

  test("preserves folder structure under the copy root", {
    given: {
      fixture_tree,
      glob_fixtures_txt,
    },
    when: {
      files_are_copied,
    },
    then: {
      workspace_has_fixtures_suite_a_foo,
      workspace_has_fixtures_suite_b_nested_bar,
    },
  });

  test("strips a matching base path prefix", {
    given: {
      fixture_tree,
      glob_fixtures_txt,
      base_fixtures_star,
    },
    when: {
      files_are_copied,
    },
    then: {
      workspace_has_foo_at_root,
      workspace_has_nested_bar,
    },
  });

  test("copies files from multiple globs", {
    given: {
      fixture_tree,
      globs_suite_a_and_suite_b,
    },
    when: {
      files_are_copied,
    },
    then: {
      workspace_has_fixtures_suite_a_foo,
      workspace_has_fixtures_suite_b_nested_bar,
    },
  });

  test("creates nested destination directories", {
    given: {
      nested_only_tree,
      glob_all_txt,
    },
    when: {
      files_are_copied,
    },
    then: {
      workspace_has_deep_nested_file,
    },
  });

  test("throws when a glob matches no files", {
    given: {
      glob_missing,
    },
    when: {
      files_are_copied,
    },
    then: {
      expect_error: empty_glob_error,
    },
  });

  test("throws when a file does not match base", {
    given: {
      fixture_tree,
      file_outside_fixtures,
      glob_all_txt,
      base_fixtures_star,
    },
    when: {
      files_are_copied,
    },
    then: {
      expect_error: base_mismatch_error,
    },
  });

  test("resolves globs from the current spec directory by default", {
    given: {
      glob_sibling_fixture,
      no_from_override,
    },
    when: {
      files_are_copied,
    },
    then: {
      workspace_has_sibling_fixture,
    },
  });
});

async function setup_temp_dirs(this: Context) {
  this.sourceRoot = await mkdtemp(join(tmpdir(), "copy-src-"));
  this.workspace = await mkdtemp(join(tmpdir(), "copy-ws-"));
  this.options = { from: this.sourceRoot };
}
async function cleanup_temp_dirs(this: Context) {
  await rm(this.sourceRoot, { recursive: true, force: true });
  await rm(this.workspace, { recursive: true, force: true });
}

async function fixture_tree(this: Context) {
  await writeRelative(this.sourceRoot, "fixtures/suite-a/foo.txt", "foo");
  await writeRelative(this.sourceRoot, "fixtures/suite-b/nested/bar.txt", "bar");
}

async function nested_only_tree(this: Context) {
  await writeRelative(this.sourceRoot, "deep/nested/file.txt", "nested");
}

async function file_outside_fixtures(this: Context) {
  await writeRelative(this.sourceRoot, "other/x.txt", "nope");
}

function glob_fixtures_txt(this: Context) {
  this.globs = ["fixtures/**/*.txt"];
}

function globs_suite_a_and_suite_b(this: Context) {
  this.globs = ["fixtures/suite-a/*.txt", "fixtures/suite-b/**/*.txt"];
}

function glob_all_txt(this: Context) {
  this.globs = ["**/*.txt"];
}

function glob_missing(this: Context) {
  this.globs = ["missing/**/*.txt"];
}

function glob_sibling_fixture(this: Context) {
  this.globs = ["copy_to_workspace.fixtures/hello.txt"];
}

function base_fixtures_star(this: Context) {
  this.options = { from: this.sourceRoot, base: "fixtures/*" };
}

function no_from_override(this: Context) {
  this.options = {};
}

async function files_are_copied(this: Context) {
  await copy_to_workspace(this.workspace, this.globs, this.options);
}

async function workspace_has_fixtures_suite_a_foo(this: Context) {
  await expectFile(this.workspace, "fixtures/suite-a/foo.txt", "foo");
}

async function workspace_has_fixtures_suite_b_nested_bar(this: Context) {
  await expectFile(this.workspace, "fixtures/suite-b/nested/bar.txt", "bar");
}

async function workspace_has_foo_at_root(this: Context) {
  await expectFile(this.workspace, "foo.txt", "foo");
}

async function workspace_has_nested_bar(this: Context) {
  await expectFile(this.workspace, "nested/bar.txt", "bar");
}

async function workspace_has_deep_nested_file(this: Context) {
  await expectFile(this.workspace, "deep/nested/file.txt", "nested");
}

async function workspace_has_sibling_fixture(this: Context) {
  await expectFile(this.workspace, "copy_to_workspace.fixtures/hello.txt", "hello\n");
}

function empty_glob_error(this: Context, error: Error) {
  expect(error.message).toContain("matched no files");
  expect(error.message).toContain("missing/**/*.txt");
}

function base_mismatch_error(this: Context, error: Error) {
  expect(error.message).toContain("does not match base");
  expect(error.message).toContain("fixtures/*");
}

async function writeRelative(root: string, relativePath: string, contents: string): Promise<void> {
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents, "utf-8");
}

async function expectFile(root: string, relativePath: string, contents: string): Promise<void> {
  const actual = await readFile(join(root, relativePath), "utf-8");
  expect(actual).toBe(contents);
}
