import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { topoSort } from "./graph.js";
import { parseDockerfiles } from "./parse.js";

type Context = {
  dir: string;
  error?: Error;
  tags?: string[];
};

describe("parseDockerfiles + topoSort", () => {
  test("orders images by FROM dependencies", {
    given: {
      folder_with_base_and_cursor,
    },
    when: {
      parsing_and_sorting,
    },
    then: {
      base_before_cursor,
    },
  });

  test("errors when the first line is not a tag comment", {
    given: {
      folder_missing_tag_comment,
    },
    when: {
      parsing_catching_error,
    },
    then: {
      error_mentions_tag_comment,
    },
  });

  test("errors on a dependency cycle", {
    given: {
      folder_with_cycle,
    },
    when: {
      parsing_and_sorting_catching_error,
    },
    then: {
      error_mentions_cycle,
    },
  });

  test("errors on duplicate tags", {
    given: {
      folder_with_duplicate_tags,
    },
    when: {
      parsing_catching_error,
    },
    then: {
      error_mentions_duplicate,
    },
  });
});

function folder_with_base_and_cursor(this: Context) {
  this.dir = mkdtempSync(join(tmpdir(), "clanker-parse-"));
  writeFileSync(
    join(this.dir, "base.Dockerfile"),
    "# clanker-cleanroom/base\nFROM archlinux:latest\n",
  );
  writeFileSync(
    join(this.dir, "cursor.Dockerfile"),
    "# clanker-cleanroom/cursor\nFROM clanker-cleanroom/base\n",
  );
}

function folder_missing_tag_comment(this: Context) {
  this.dir = mkdtempSync(join(tmpdir(), "clanker-parse-"));
  writeFileSync(join(this.dir, "bad.Dockerfile"), "FROM archlinux:latest\n");
}

function folder_with_cycle(this: Context) {
  this.dir = mkdtempSync(join(tmpdir(), "clanker-parse-"));
  writeFileSync(join(this.dir, "a.Dockerfile"), "# a\nFROM b\n");
  writeFileSync(join(this.dir, "b.Dockerfile"), "# b\nFROM a\n");
}

function folder_with_duplicate_tags(this: Context) {
  this.dir = mkdtempSync(join(tmpdir(), "clanker-parse-"));
  writeFileSync(join(this.dir, "one.Dockerfile"), "# same\nFROM archlinux:latest\n");
  writeFileSync(join(this.dir, "two.Dockerfile"), "# same\nFROM archlinux:latest\n");
}

function parsing_and_sorting(this: Context) {
  this.tags = topoSort(parseDockerfiles(this.dir)).map((entry) => entry.tag);
}

function parsing_catching_error(this: Context) {
  try {
    parseDockerfiles(this.dir);
  } catch (error) {
    this.error = error as Error;
  }
}

function parsing_and_sorting_catching_error(this: Context) {
  try {
    topoSort(parseDockerfiles(this.dir));
  } catch (error) {
    this.error = error as Error;
  }
}

function base_before_cursor(this: Context) {
  expect(this.tags).toEqual(["clanker-cleanroom/base", "clanker-cleanroom/cursor"]);
}

function error_mentions_tag_comment(this: Context) {
  expect(this.error?.message).toContain("tag comment");
}

function error_mentions_cycle(this: Context) {
  expect(this.error?.message).toContain("cycle");
}

function error_mentions_duplicate(this: Context) {
  expect(this.error?.message).toContain("Duplicate");
}
