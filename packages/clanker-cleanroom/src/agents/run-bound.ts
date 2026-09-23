import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { CONTAINER_HOME, CONTAINER_OUTPUT, CONTAINER_WORKSPACE } from "./base/constants.js";
import { buildDockerRunArgs, runDocker } from "./docker.js";
import {
  applyPathRemaps,
  CLANKER_PATH_REMAPS_ENV,
  composeRemaps,
  readInheritedRemaps,
  remapsAreEmpty,
  serializeRemaps,
} from "./path-remaps.js";
import { agentRunError } from "./run-error.js";
import { TRAJECTORY_FILE, wrapCommandWithTrajectoryRedirect } from "./trajectory/index.js";
import type {
  AgentBinding,
  AgentRunBindingsOptions,
  AgentRunResult,
  DockerRunner,
  DockerVolumeMount,
} from "./types.js";

export type RunBoundAgentOptions = AgentRunBindingsOptions & {
  uid?: number;
  gid?: number;
  /** Staged `/agent/input` (ro) and `/agent/output` mounts; inserted after workspace. */
  ioVolumes?: readonly DockerVolumeMount[];
  /** Resume a prior CLI session when the binding supports it. */
  sessionId?: string;
};

export async function runBoundAgent(
  binding: AgentBinding,
  options: RunBoundAgentOptions,
  dockerRunner: DockerRunner = runDocker,
): Promise<AgentRunResult> {
  const uid = options.uid ?? process.getuid?.() ?? 0;
  const gid = options.gid ?? process.getgid?.() ?? 0;
  const prepared = await binding.prepare({ workspace: options.workspace });

  const volumes: DockerVolumeMount[] = [
    { host: options.workspace, container: CONTAINER_WORKSPACE },
    ...(options.ioVolumes ?? []),
    ...(prepared.volumes ?? []),
  ];

  // Local trajectory read must use the unremapped host path (visible to this process).
  const outputHost = hostPathForContainer(volumes, CONTAINER_OUTPUT);
  if (outputHost === undefined) {
    throw new Error(
      `runBoundAgent requires an ioVolume mounted at ${CONTAINER_OUTPUT} to capture trajectory`,
    );
  }

  const inherited = readInheritedRemaps();
  const dockerVolumes = volumes.map((volume) => ({
    ...volume,
    host: applyPathRemaps(volume.host, inherited),
  }));

  const childRemaps = composeRemaps(inherited, options.remaps ?? {});
  const containerEnv: Record<string, string> = { HOME: CONTAINER_HOME };
  if (!remapsAreEmpty(childRemaps)) {
    containerEnv[CLANKER_PATH_REMAPS_ENV] = serializeRemaps(childRemaps);
  }

  const env = prepared.env ?? {};
  const args = buildDockerRunArgs({
    image: options.image,
    uid,
    gid,
    workdir: CONTAINER_WORKSPACE,
    env: containerEnv,
    envPassthrough: Object.keys(env),
    volumes: dockerVolumes,
    command: wrapCommandWithTrajectoryRedirect(
      binding.command({
        prompt: options.prompt,
        ...(options.model !== undefined ? { model: options.model } : {}),
        ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
      }),
    ),
  });

  const result = await dockerRunner(args, { env });
  const trajectory = await readTrajectoryFile(outputHost);

  if (result.exitCode !== 0) {
    throw agentRunError({
      agent: binding.displayName,
      image: options.image,
      result,
      detail: binding.describeFailure?.(trajectory),
    });
  }

  return binding.parseResult(trajectory);
}

function hostPathForContainer(
  volumes: readonly DockerVolumeMount[],
  containerPath: string,
): string | undefined {
  return volumes.find((volume) => volume.container === containerPath)?.host;
}

async function readTrajectoryFile(outputHost: string): Promise<string> {
  try {
    return await readFile(join(outputHost, TRAJECTORY_FILE), "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      return "";
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
