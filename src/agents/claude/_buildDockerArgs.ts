import { CONTAINER_HOME, CONTAINER_WORKSPACE } from "../base/constants.js";
import { buildDockerRunArgs } from "../docker.js";
import type { DockerVolumeMount } from "../types.js";
import { credentialsEnv } from "./_credentialsEnv.js";
import type { ClaudeCredentials } from "./_resolveCredentials.js";
import { CLAUDE_CONTAINER_CREDENTIALS_PATH } from "./constants.js";

export function buildClaudeDockerArgs(options: {
  workspace: string;
  prompt: string;
  image: string;
  credentials: ClaudeCredentials;
  uid: number;
  gid: number;
  model?: string;
}): string[] {
  const claudeArgs = ["claude", "-p", "--output-format", "json", "--dangerously-skip-permissions"];

  if (options.model !== undefined && options.model !== "") {
    claudeArgs.push("--model", options.model);
  }

  claudeArgs.push("--", options.prompt);

  const volumes: DockerVolumeMount[] = [
    { host: options.workspace, container: CONTAINER_WORKSPACE },
  ];

  if (options.credentials.kind === "credentials-file") {
    volumes.push({
      host: options.credentials.file,
      container: CLAUDE_CONTAINER_CREDENTIALS_PATH,
      mode: "ro",
    });
  }

  return buildDockerRunArgs({
    image: options.image,
    uid: options.uid,
    gid: options.gid,
    workdir: CONTAINER_WORKSPACE,
    env: { HOME: CONTAINER_HOME },
    // Names only; the values reach the container through the docker CLI's own environment.
    envPassthrough: Object.keys(credentialsEnv(options.credentials)),
    volumes,
    command: claudeArgs,
  });
}
