import { trackContainer, untrackContainer } from "./_containerRegistry.js";
import { removeContainer } from "./_removeContainer.js";
import { runProcess } from "./_runProcess.js";
import type { BuildDockerRunArgsOptions, DockerRunResult, DockerRunner } from "./types.js";

export type {
  BuildDockerRunArgsOptions,
  DockerRunOptions,
  DockerRunResult,
  DockerRunner,
  DockerVolumeMount,
} from "./types.js";

export const runDocker: DockerRunner = async (args, options = {}) => {
  const { containerName, ...processOptions } = options;

  if (containerName === undefined) {
    return runProcess("docker", args, processOptions);
  }

  trackContainer(containerName);
  try {
    return await runProcess("docker", args, {
      ...processOptions,
      onAbort: () => removeContainer(containerName),
    });
  } finally {
    untrackContainer(containerName);
  }
};

export function buildDockerRunArgs(options: BuildDockerRunArgsOptions): string[] {
  const args = ["run", "--rm", "--user", `${options.uid}:${options.gid}`];

  if (options.name !== undefined) {
    args.push("--name", options.name);
  }

  if (options.interactive === true) {
    args.push("-i");
  }

  if (options.env !== undefined) {
    for (const [key, value] of Object.entries(options.env)) {
      args.push("-e", `${key}=${value}`);
    }
  }

  if (options.envPassthrough !== undefined) {
    for (const name of options.envPassthrough) {
      args.push("-e", name);
    }
  }

  if (options.volumes !== undefined) {
    for (const volume of options.volumes) {
      const modeSuffix = volume.mode === "ro" ? ":ro" : "";
      args.push("-v", `${volume.host}:${volume.container}${modeSuffix}`);
    }
  }

  args.push("-w", options.workdir, options.image, ...options.command);

  return args;
}

export async function invokeDocker(
  options: BuildDockerRunArgsOptions,
  dockerRunner: DockerRunner = runDocker,
): Promise<DockerRunResult> {
  return dockerRunner(buildDockerRunArgs(options));
}
