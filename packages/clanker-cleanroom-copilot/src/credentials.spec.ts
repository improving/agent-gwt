import { describe, expect } from "vitest";
import test, { withAspect } from "vitest-gwt";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type CopilotCredentials, resolveCopilotCredentials } from "./credentials.js";
import { COPILOT_TOKEN_ENVS } from "./constants.js";

const SECRET = "github_pat_copilot-super-secret";

type Context = {
  home: string;
  hostEnv: NodeJS.ProcessEnv;
  resolved: CopilotCredentials;
};

describe("resolveCopilotCredentials", () => {
  withAspect(a_temp_home, remove_temp_home);

  test("prefers COPILOT_GITHUB_TOKEN over lower-precedence token envs", {
    given: {
      a_config_dir_in_home,
      host_env_with_all_token_vars,
    },
    when: {
      resolving_credentials,
    },
    then: {
      resolves_copilot_token_env,
    },
  });

  test("falls back to GH_TOKEN", {
    given: {
      a_config_dir_in_home,
      host_env_with_gh_token,
    },
    when: {
      resolving_credentials,
    },
    then: {
      resolves_gh_token,
    },
  });

  test("falls back to a readable config directory", {
    given: {
      a_config_dir_in_home,
      empty_host_env,
    },
    when: {
      resolving_credentials,
    },
    then: {
      resolves_config_dir,
    },
  });

  test("throws with guidance when nothing is configured", {
    given: {
      empty_host_env,
    },
    when: {
      resolving_credentials,
    },
    then: {
      expect_error: error_explains_how_to_authenticate,
    },
  });
});

async function a_temp_home(this: Context) {
  this.home = await mkdtemp(join(tmpdir(), "agent-gwt-home-"));
}

async function remove_temp_home(this: Context) {
  if (this.home === undefined || this.home === "") {
    return;
  }

  await rm(this.home, { recursive: true, force: true });
}

async function a_config_dir_in_home(this: Context) {
  await mkdir(join(this.home, ".copilot"), { recursive: true });
}

function host_env_with_all_token_vars(this: Context) {
  this.hostEnv = {
    [COPILOT_TOKEN_ENVS[0]]: SECRET,
    GH_TOKEN: "gh-token",
    GITHUB_TOKEN: "github-token",
  };
}

function host_env_with_gh_token(this: Context) {
  this.hostEnv = { GH_TOKEN: "gh-token" };
}

function empty_host_env(this: Context) {
  this.hostEnv = {};
}

async function resolving_credentials(this: Context) {
  this.resolved = await resolveCopilotCredentials({ env: this.hostEnv, home: this.home });
}

function resolves_copilot_token_env(this: Context) {
  expect(this.resolved).toEqual({ kind: "token-env", envVar: COPILOT_TOKEN_ENVS[0], token: SECRET });
}

function resolves_gh_token(this: Context) {
  expect(this.resolved).toEqual({ kind: "token-env", envVar: "GH_TOKEN", token: "gh-token" });
}

function resolves_config_dir(this: Context) {
  expect(this.resolved).toEqual({
    kind: "config-dir",
    dir: join(this.home, ".copilot"),
  });
}

function error_explains_how_to_authenticate(this: Context, error: Error) {
  expect(error.message).toContain("copilot login");
  expect(error.message).toContain(COPILOT_TOKEN_ENVS[0]);
}
