import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { AGENTS_GWT_TMP_ROOT, a_workspace, cleanup_workspace } from "./a_workspace.js";
import type { AgentContext } from "../types.js";

type Context = AgentContext & {
  firstWorkspace?: string;
};

describe("a_workspace", () => {
  test("creates a unique directory under /tmp/.agents-gwt", {
    when: {
      a_workspace,
    },
    then: {
      workspace_is_under_agents_gwt_tmp,
      workspace_directory_exists,
    },
  });

  test("creates a different directory each invocation", {
    when: {
      two_workspaces_are_created,
    },
    then: {
      workspaces_are_different_paths,
    },
  });

  test("removes the workspace directory", {
    given: {
      a_workspace,
    },
    when: {
      cleanup_workspace,
    },
    then: {
      workspace_no_longer_exists,
    },
  });
});

async function workspace_is_under_agents_gwt_tmp(this: Context) {
  expect(this.workspace.startsWith(AGENTS_GWT_TMP_ROOT)).toBe(true);
}

async function workspace_directory_exists(this: Context) {
  const info = await stat(this.workspace);
  expect(info.isDirectory()).toBe(true);
}

async function two_workspaces_are_created(this: Context) {
  await a_workspace.call(this);
  this.firstWorkspace = this.workspace;
  await a_workspace.call(this);
}

function workspaces_are_different_paths(this: Context) {
  expect(this.workspace).not.toBe(this.firstWorkspace);
}

async function workspace_no_longer_exists(this: Context) {
  await expect(access(this.workspace, fsConstants.F_OK)).rejects.toThrow();
  // avoid afterEach double-delete noise
  this.workspace = "";
}
