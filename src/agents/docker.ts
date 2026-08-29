import { spawn } from "node:child_process";

import type { BuildDockerRunArgsOptions, DockerRunResult, DockerRunner } from "./types.js";

export type {
  BuildDockerRunArgsOptions,
  DockerRunResult,
  DockerRunner,
  DockerVolumeMount,
} from "./types.js";

export const runDocker: DockerRunner = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: Error) => {
      reject(
        new Error(`Failed to start docker: ${error.message}. Is Docker installed and running?`),
      );
    });

    child.on("close", (exitCode: number | null) => {
      resolve({ exitCode, stdout, stderr });
    });
  });

export function buildDockerRunArgs(options: BuildDockerRunArgsOptions): string[] {
  const args = ["run", "--rm", "--user", `${options.uid}:${options.gid}`];

  if (options.env !== undefined) {
    for (const [key, value] of Object.entries(options.env)) {
      args.push("-e", `${key}=${value}`);
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
