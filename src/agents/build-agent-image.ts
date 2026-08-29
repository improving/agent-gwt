import { existsSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_ROOT } from "../package-root.js";
import { BASE_DOCKERFILE_RELATIVE, BASE_IMAGE } from "./base/constants.js";
import { runDocker } from "./docker.js";
import type { AgentName } from "./registry.js";
import { resolveAgent } from "./registry.js";
import type { BuildDockerImageOptions, DockerRunner } from "./types.js";

const builtImages = new Map<string, Promise<void>>();

export function resetBuiltImages(): void {
  builtImages.clear();
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

export type BuildBaseImageOptions = {
  dockerRunner?: DockerRunner;
  packageRoot?: string;
};

export async function buildBaseImage(options: BuildBaseImageOptions = {}): Promise<void> {
  await buildDockerImage(BASE_IMAGE, {
    dockerfileRelative: BASE_DOCKERFILE_RELATIVE,
    packageRoot: options.packageRoot ?? PACKAGE_ROOT,
    ...(options.dockerRunner !== undefined ? { dockerRunner: options.dockerRunner } : {}),
  });
}

export async function buildAgentImage(name: AgentName): Promise<void> {
  await resolveAgent(name).buildImage();
}

async function doBuild(
  image: string,
  dockerfileRelative: string,
  dockerRunner: DockerRunner,
  packageRoot: string,
): Promise<void> {
  const inspect = await dockerRunner(["image", "inspect", image]);
  if (inspect.exitCode === 0) {
    process.stderr.write(`[agent-gwt] Docker image ${image} already present\n`);
    return;
  }

  const dockerfile = join(packageRoot, dockerfileRelative);
  if (!existsSync(dockerfile)) {
    throw new Error(`Dockerfile not found at ${dockerfile}`);
  }

  process.stderr.write(`[agent-gwt] Building Docker image ${image}...\n`);

  const build = await dockerRunner(
    ["build", "--progress=plain", "-t", image, "-f", dockerfile, packageRoot],
    { inheritOutput: true },
  );

  if (build.exitCode !== 0) {
    throw new Error(
      `Failed to build image ${image}.\nstderr:\n${build.stderr}\nstdout:\n${build.stdout}`,
    );
  }

  process.stderr.write(`[agent-gwt] Built Docker image ${image}\n`);
}
