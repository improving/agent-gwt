import { describe, expect } from "vitest";
import test, { withAspect } from "vitest-gwt";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type DevinCredentials, resolveDevinCredentials } from "./credentials.js";
import { DEVIN_API_KEY_ENV } from "./constants.js";

const SECRET = "devin-api-key-super-secret";

type Context = {
  home: string;
  hostEnv: NodeJS.ProcessEnv;
  resolved: DevinCredentials;
};

describe("resolveDevinCredentials", () => {
  withAspect(a_temp_home, remove_temp_home);

  test("prefers an env API key over a credentials file", {
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
  await mkdir(join(this.home, ".local", "share", "devin"), { recursive: true });
  await writeFile(join(this.home, ".local", "share", "devin", "credentials.toml"), "token = \"x\"\n");
}

function host_env_with_api_key(this: Context) {
  this.hostEnv = { [DEVIN_API_KEY_ENV]: SECRET };
}

function empty_host_env(this: Context) {
  this.hostEnv = {};
}

async function resolving_credentials(this: Context) {
  this.resolved = await resolveDevinCredentials({ env: this.hostEnv, home: this.home });
}

function resolves_api_key(this: Context) {
  expect(this.resolved).toEqual({ kind: "api-key", apiKey: SECRET });
}

function resolves_credentials_file(this: Context) {
  expect(this.resolved).toEqual({
    kind: "credentials-file",
    file: join(this.home, ".local", "share", "devin", "credentials.toml"),
  });
}

function error_explains_how_to_authenticate(this: Context, error: Error) {
  expect(error.message).toContain("devin auth login");
  expect(error.message).toContain(DEVIN_API_KEY_ENV);
}
