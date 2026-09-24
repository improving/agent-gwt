import { describe, expect } from "vitest";
import test from "vitest-gwt";

import {
  applyPathRemaps,
  CLANKER_PATH_REMAPS_ENV,
  composeRemaps,
  readInheritedRemaps,
  serializeRemaps,
  type Remaps,
} from "./path-remaps.js";

type Context = {
  remaps?: Remaps;
  inherited: Remaps;
  next: Remaps;
  hostPath: string;
  result: string;
  composed: Remaps;
  env: NodeJS.ProcessEnv;
  read: Remaps;
};

describe("applyPathRemaps", () => {
  test("replaces the longest matching prefix", {
    given: {
      remaps_with_nested_keys,
      path_under_longer_key,
    },
    when: {
      applying_remaps,
    },
    then: {
      uses_longer_prefix,
    },
  });

  test("replaces an exact key match", {
    given: {
      remaps_simple,
      path_exact_key,
    },
    when: {
      applying_remaps,
    },
    then: {
      exact_key_replaced,
    },
  });

  test("leaves unmatched paths unchanged", {
    given: {
      remaps_simple,
      path_unrelated,
    },
    when: {
      applying_remaps,
    },
    then: {
      path_unchanged,
    },
  });

  test("no-ops when remaps are undefined", {
    given: {
      path_unrelated,
    },
    when: {
      applying_remaps_undefined,
    },
    then: {
      path_unchanged,
    },
  });
});

describe("composeRemaps", () => {
  test("rewrites next values through inherited so nesting maps to the root host", {
    given: {
      inherited_workspace_to_host,
      next_nested_to_workspace,
    },
    when: {
      composing_remaps,
    },
    then: {
      composed_maps_nested_to_host,
      composed_keeps_inherited,
    },
  });
});

describe("readInheritedRemaps", () => {
  test("parses JSON remaps from the env", {
    given: {
      env_with_valid_remaps,
    },
    when: {
      reading_inherited,
    },
    then: {
      read_matches_serialized,
    },
  });

  test("returns empty for missing or invalid env", {
    given: {
      env_with_invalid_json,
    },
    when: {
      reading_inherited,
    },
    then: {
      read_is_empty,
    },
  });
});

function remaps_with_nested_keys(this: Context) {
  this.remaps = {
    "/inside": "/host",
    "/inside/path": "/host/path",
  };
}

function remaps_simple(this: Context) {
  this.remaps = { "/inside/path": "/host/path" };
}

function path_under_longer_key(this: Context) {
  this.hostPath = "/inside/path/foo";
}

function path_exact_key(this: Context) {
  this.hostPath = "/inside/path";
}

function path_unrelated(this: Context) {
  this.hostPath = "/other/place";
}

function applying_remaps(this: Context) {
  this.result = applyPathRemaps(this.hostPath, this.remaps);
}

function applying_remaps_undefined(this: Context) {
  this.result = applyPathRemaps(this.hostPath, undefined);
}

function uses_longer_prefix(this: Context) {
  expect(this.result).toBe("/host/path/foo");
}

function exact_key_replaced(this: Context) {
  expect(this.result).toBe("/host/path");
}

function path_unchanged(this: Context) {
  expect(this.result).toBe(this.hostPath);
}

function inherited_workspace_to_host(this: Context) {
  this.inherited = { "/workspace": "/host/ws" };
}

function next_nested_to_workspace(this: Context) {
  this.next = { "/nested": "/workspace/job" };
}

function composing_remaps(this: Context) {
  this.composed = composeRemaps(this.inherited, this.next);
}

function composed_maps_nested_to_host(this: Context) {
  expect(this.composed["/nested"]).toBe("/host/ws/job");
}

function composed_keeps_inherited(this: Context) {
  expect(this.composed["/workspace"]).toBe("/host/ws");
}

function env_with_valid_remaps(this: Context) {
  this.remaps = { "/inside/path": "/host/path" };
  this.env = { [CLANKER_PATH_REMAPS_ENV]: serializeRemaps(this.remaps) };
}

function env_with_invalid_json(this: Context) {
  this.env = { [CLANKER_PATH_REMAPS_ENV]: "{not-json" };
}

function reading_inherited(this: Context) {
  this.read = readInheritedRemaps(this.env);
}

function read_matches_serialized(this: Context) {
  expect(this.read).toEqual(this.remaps);
}

function read_is_empty(this: Context) {
  expect(this.read).toEqual({});
}
