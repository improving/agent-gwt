import { describe, expect } from "vitest";
import test from "vitest-gwt";

import {
  buildDockerRunArgs,
  CONTAINER_HOME,
  CONTAINER_TRAJECTORY_PATH,
  CONTAINER_WORKSPACE,
  type DockerVolumeMount,
} from "clanker-cleanroom";

import { devinBinding } from "./binding.js";
import { credentialsEnv, type DevinCredentials } from "./credentials.js";
import { DEVIN_API_KEY_ENV, DEVIN_CONTAINER_CREDENTIALS_PATH } from "./constants.js";

const SECRET = "devin-api-key-super-secret";

type Context = {
  args: string[];
  credentials: DevinCredentials;
};

const envFlagValues = (args: string[]) => args.filter((arg, i) => args[i - 1] === "-e");
const volumeMounts = (args: string[]) => args.filter((arg, i) => args[i - 1] === "-v");

describe("devinBinding.command", () => {
  test("runs as host user with an API key forwarded by name only", {
    given: {
      api_key_credentials,
    },
    when: {
      building_docker_args,
    },
    then: {
      uses_host_uid_gid,
      sets_container_home,
      mounts_workspace,
      forwards_api_key_env_by_name,
      secret_is_not_on_argv,
      does_not_mount_credentials_file,
      invokes_devin_headless_exporting_atif_to_trajectory_path,
    },
  });

  test("mounts a credentials file read-only", {
    given: {
      credentials_file_credentials,
    },
    when: {
      building_docker_args,
    },
    then: {
      mounts_credentials_file_read_only,
      forwards_no_secret_env,
    },
  });

  test("includes --model when a model is provided", {
    given: {
      api_key_credentials,
    },
    when: {
      building_docker_args_with_model,
    },
    then: {
      includes_model_flag,
    },
  });
});

function api_key_credentials(this: Context) {
  this.credentials = { kind: "api-key", apiKey: SECRET };
}

function credentials_file_credentials(this: Context) {
  this.credentials = { kind: "credentials-file", file: "/home/dev/.local/share/devin/credentials.toml" };
}

function building_docker_args(this: Context) {
  this.args = dockerArgs(this.credentials);
}

function building_docker_args_with_model(this: Context) {
  this.args = dockerArgs(this.credentials, { model: "opus" });
}

function dockerArgs(credentials: DevinCredentials, options: { model?: string } = {}): string[] {
  const volumes: DockerVolumeMount[] = [
    { host: "/tmp/.agents-gwt/ws-abc", container: CONTAINER_WORKSPACE },
  ];
  if (credentials.kind === "credentials-file") {
    volumes.push({
      host: credentials.file,
      container: DEVIN_CONTAINER_CREDENTIALS_PATH,
      mode: "ro",
    });
  }

  return buildDockerRunArgs({
    image: "clanker-cleanroom/devin",
    uid: 1000,
    gid: 1000,
    workdir: CONTAINER_WORKSPACE,
    env: { HOME: CONTAINER_HOME },
    envPassthrough: Object.keys(credentialsEnv(credentials)),
    volumes,
    command: devinBinding.command({
      prompt: "Create a README",
      ...(options.model !== undefined ? { model: options.model } : {}),
    }),
  });
}

function uses_host_uid_gid(this: Context) {
  expect(this.args).toContain("--user");
  expect(this.args[this.args.indexOf("--user") + 1]).toBe("1000:1000");
}

function sets_container_home(this: Context) {
  expect(envFlagValues(this.args)).toContain(`HOME=${CONTAINER_HOME}`);
}

function mounts_workspace(this: Context) {
  expect(this.args).toContain(`/tmp/.agents-gwt/ws-abc:${CONTAINER_WORKSPACE}`);
}

function forwards_api_key_env_by_name(this: Context) {
  expect(envFlagValues(this.args)).toContain(DEVIN_API_KEY_ENV);
}

function forwards_no_secret_env(this: Context) {
  expect(envFlagValues(this.args)).not.toContain(DEVIN_API_KEY_ENV);
}

function secret_is_not_on_argv(this: Context) {
  for (const arg of this.args) {
    expect(arg.includes(SECRET)).toBe(false);
  }
}

function does_not_mount_credentials_file(this: Context) {
  for (const mount of volumeMounts(this.args)) {
    expect(mount.includes(DEVIN_CONTAINER_CREDENTIALS_PATH)).toBe(false);
  }
}

function mounts_credentials_file_read_only(this: Context) {
  expect(this.args).toContain(
    `/home/dev/.local/share/devin/credentials.toml:${DEVIN_CONTAINER_CREDENTIALS_PATH}:ro`,
  );
}

function invokes_devin_headless_exporting_atif_to_trajectory_path(this: Context) {
  expect(this.args).toContain("-p");
  expect(this.args).toContain("--permission-mode");
  expect(this.args).toContain("bypass");
  expect(this.args).toContain("--export");
  expect(this.args).toContain(CONTAINER_TRAJECTORY_PATH);
  expect(this.args).toContain("--");
  expect(this.args.at(-1)).toBe("Create a README");
}

function includes_model_flag(this: Context) {
  const modelIndex = this.args.indexOf("--model");
  expect(modelIndex).toBeGreaterThan(-1);
  expect(this.args[modelIndex + 1]).toBe("opus");
  expect(this.args.indexOf("--")).toBeGreaterThan(modelIndex);
}
