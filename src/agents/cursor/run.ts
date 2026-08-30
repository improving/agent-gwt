import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";

import { CONTAINER_HOME, CONTAINER_WORKSPACE } from "../base/constants.js";
import { buildDockerRunArgs, runDocker } from "../docker.js";
import { parseAgentJsonOutput } from "../parse-result.js";
import { agentRunError } from "../run-error.js";
import type { DockerRunner, AgentRunBindingsOptions } from "../types.js";
import { CONTAINER_AUTH_PATH, defaultHostAuthFile } from "./constants.js";

export type RunCursorInDockerOptions = AgentRunBindingsOptions & {
  authFile?: string;
  uid?: number;
  gid?: number;
};

export function buildDockerArgs(options: {
  workspace: string;
  prompt: string;
  image: string;
  authFile: string;
  uid: number;
  gid: number;
  model?: string;
}): string[] {
  const agentArgs = ["agent", "-p", "--force", "--output-format", "json"];

  if (options.model !== undefined && options.model !== "") {
    agentArgs.push("--model", options.model);
  }

  agentArgs.push("--", options.prompt);

  return buildDockerRunArgs({
    image: options.image,
    uid: options.uid,
    gid: options.gid,
    workdir: CONTAINER_WORKSPACE,
    env: { HOME: CONTAINER_HOME },
    volumes: [
      { host: options.workspace, container: CONTAINER_WORKSPACE },
      { host: options.authFile, container: CONTAINER_AUTH_PATH, mode: "ro" },
    ],
    command: agentArgs,
  });
}

export async function runCursorInDocker(
  options: RunCursorInDockerOptions,
  dockerRunner: DockerRunner = runDocker,
): Promise<unknown> {
  const authFile = options.authFile ?? defaultHostAuthFile(homedir());
  const uid = options.uid ?? process.getuid?.() ?? 0;
  const gid = options.gid ?? process.getgid?.() ?? 0;

  try {
    await access(authFile, fsConstants.R_OK);
  } catch {
    throw new Error(
      `Cursor credentials not found at ${authFile}. Run \`agent login\` on the host first.`,
    );
  }

  const args = buildDockerArgs({
    workspace: options.workspace,
    prompt: options.prompt,
    image: options.image,
    authFile,
    uid,
    gid,
    ...(options.model !== undefined ? { model: options.model } : {}),
  });

  const result = await dockerRunner(args);

  if (result.exitCode !== 0) {
    throw agentRunError({ agent: "Cursor", name: "cursor", image: options.image, result });
  }

  return parseAgentJsonOutput(result.stdout);
}
