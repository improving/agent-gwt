import { CONTAINER_HOME, CONTAINER_WORKSPACE } from "../base/constants.js";
import { buildDockerRunArgs } from "../docker.js";
import { CONTAINER_AUTH_PATH } from "./constants.js";

export function buildDockerArgs(options: {
  workspace: string;
  image: string;
  containerName?: string;
  authFile: string;
  uid: number;
  gid: number;
  model?: string;
}): string[] {
  const agentArgs = ["agent", "-p", "--force", "--output-format", "json"];

  if (options.model !== undefined && options.model !== "") {
    agentArgs.push("--model", options.model);
  }

  return buildDockerRunArgs({
    image: options.image,
    uid: options.uid,
    gid: options.gid,
    workdir: CONTAINER_WORKSPACE,
    ...(options.containerName !== undefined ? { name: options.containerName } : {}),
    interactive: true,
    env: { HOME: CONTAINER_HOME },
    volumes: [
      { host: options.workspace, container: CONTAINER_WORKSPACE },
      { host: options.authFile, container: CONTAINER_AUTH_PATH, mode: "ro" },
    ],
    command: agentArgs,
  });
}
