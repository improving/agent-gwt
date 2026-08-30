import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";

import { runDocker } from "../docker.js";
import { parseAgentJsonOutput } from "../parse-result.js";
import { agentRunError } from "../run-error.js";
import type { DockerRunner, AgentRunBindingsOptions } from "../types.js";
import { containerName } from "../_containerName.js";
import { buildDockerArgs } from "./_buildDockerArgs.js";
import { defaultHostAuthFile } from "./constants.js";

export type RunCursorInDockerOptions = AgentRunBindingsOptions & {
  authFile?: string;
  uid?: number;
  gid?: number;
};

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

  const name = containerName("cursor");
  const args = buildDockerArgs({
    workspace: options.workspace,
    image: options.image,
    containerName: name,
    authFile,
    uid,
    gid,
    ...(options.model !== undefined ? { model: options.model } : {}),
  });

  const result = await dockerRunner(args, {
    stdin: options.prompt,
    containerName: name,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });

  if (result.exitCode !== 0) {
    throw agentRunError({ agent: "Cursor", name: "cursor", image: options.image, result });
  }

  return parseAgentJsonOutput(result.stdout);
}
