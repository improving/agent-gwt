import { existsSync } from "node:fs";
import { join } from "node:path";

import { runDocker } from "./docker.js";
import type { BuildDockerImageOptions, DockerRunner, EnsureDockerImageOptions } from "./types.js";

const builtImages = new Map<string, Promise<void>>();

export function resetEnsuredImages(): void {
  builtImages.clear();
}

export async function ensureDockerImage(
  image: string,
  options: EnsureDockerImageOptions = {},
): Promise<void> {
  const dockerRunner = options.dockerRunner ?? runDocker;
  const inspect = await dockerRunner(["image", "inspect", image]);
  if (inspect.exitCode === 0) {
    return;
  }

  throw new Error(
    `Docker image ${image} not found. Call buildAgentImage(...) from vitest globalSetup (or build the image manually) before running agent tests.`,
  );
}

export async function buildDockerImage(
  image: string,
  options: BuildDockerImageOptions,
): Promise<void> {
  const dockerRunner = options.dockerRunner ?? runDocker;
  const { packageRoot } = options;
  const memoKey = `${image}::${options.dockerfileRelative}::${packageRoot}`;

  const existing = builtImages.get(memoKey);
  if (existing !== undefined) {
    return existing;
  }

  const pending = doBuild(image, options.dockerfileRelative, dockerRunner, packageRoot).catch(
    (error: unknown) => {
      builtImages.delete(memoKey);
      throw error;
    },
  );

  builtImages.set(memoKey, pending);
  return pending;
}

async function doBuild(
  image: string,
  dockerfileRelative: string,
  dockerRunner: DockerRunner,
  packageRoot: string,
): Promise<void> {
  const inspect = await dockerRunner(["image", "inspect", image]);
  if (inspect.exitCode === 0) {
    return;
  }

  const dockerfile = join(packageRoot, dockerfileRelative);
  if (!existsSync(dockerfile)) {
    throw new Error(`Dockerfile not found at ${dockerfile}`);
  }

  const build = await dockerRunner(["build", "-t", image, "-f", dockerfile, packageRoot]);

  if (build.exitCode !== 0) {
    throw new Error(
      `Failed to build image ${image}.\nstderr:\n${build.stderr}\nstdout:\n${build.stdout}`,
    );
  }
}
