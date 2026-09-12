import { describe, expect } from "vitest";
import test, { withAspect } from "vitest-gwt";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type ClaudeCredentials, resolveClaudeCredentials } from "./credentials.js";
import { CLAUDE_API_KEY_ENV, CLAUDE_OAUTH_TOKEN_ENV } from "./constants.js";

const SECRET = "sk-ant-oat01-super-secret";

type Context = {
  home: string;
  hostEnv: NodeJS.ProcessEnv;
  resolved: ClaudeCredentials;
};

describe("resolveClaudeCredentials", () => {
  withAspect(a_temp_home, remove_temp_home);

  test("prefers an OAuth token over an API key and a credentials file", {
    given: {
      a_credentials_file_in_home,
      host_env_with_token_and_api_key,
    },
    when: {
      resolving_credentials,
    },
    then: {
      resolves_oauth_token,
    },
  });

  test("falls back to an API key", {
    given: {
      a_credentials_file_in_home,
      host_env_with_api_key,
    },
    when: {
      resolving_credentials,
    },
    then: {
      resolves_api_key,
    },
  });

  test("falls back to a readable credentials file", {
    given: {
      a_credentials_file_in_home,
      empty_host_env,
    },
    when: {
      resolving_credentials,
    },
    then: {
      resolves_credentials_file,
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

async function a_credentials_file_in_home(this: Context) {
  await mkdir(join(this.home, ".claude"), { recursive: true });
  await writeFile(join(this.home, ".claude", ".credentials.json"), "{}\n");
}

function host_env_with_token_and_api_key(this: Context) {
  this.hostEnv = { [CLAUDE_OAUTH_TOKEN_ENV]: SECRET, [CLAUDE_API_KEY_ENV]: "sk-ant-api" };
}

function host_env_with_api_key(this: Context) {
  this.hostEnv = { [CLAUDE_API_KEY_ENV]: "sk-ant-api" };
}

function empty_host_env(this: Context) {
  this.hostEnv = {};
}

async function resolving_credentials(this: Context) {
  this.resolved = await resolveClaudeCredentials({ env: this.hostEnv, home: this.home });
}

function resolves_oauth_token(this: Context) {
  expect(this.resolved).toEqual({ kind: "oauth-token", token: SECRET });
}

function resolves_api_key(this: Context) {
  expect(this.resolved).toEqual({ kind: "api-key", apiKey: "sk-ant-api" });
}

function resolves_credentials_file(this: Context) {
  expect(this.resolved).toEqual({
    kind: "credentials-file",
    file: join(this.home, ".claude", ".credentials.json"),
  });
}

function error_explains_how_to_authenticate(this: Context, error: Error) {
  expect(error.message).toContain("claude setup-token");
  expect(error.message).toContain(CLAUDE_OAUTH_TOKEN_ENV);
  expect(error.message).toContain(CLAUDE_API_KEY_ENV);
}
