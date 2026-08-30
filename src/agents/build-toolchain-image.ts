import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildAgentImage, buildDockerImage } from "./build-agent-image.js";
import { runDocker } from "./docker.js";
import type { AgentName } from "./registry.js";
import { resolveAgent } from "./registry.js";
import type { DockerRunner } from "./types.js";

const DIGEST_LENGTH = 12;
const AGENT_IMAGE_BUILD_ARG = "AGENT_IMAGE";

const toolchainImages = new Map<string, string>();

export type BuildToolchainImageOptions = {
  agent: AgentName;
  dockerfileRelative: string;
  /**
   * Repo root that owns the Dockerfile. Defaults to `process.cwd()`.
   * Must match the cwd used when resolving variants via `agent({ variant })`
   * (registry paths are keyed by this digest).
   */
  packageRoot?: string;
  dockerRunner?: DockerRunner;
};

export type ResolveToolchainImageOptions = {
  /** Defaults to `process.cwd()` — must match the `packageRoot` used at build time. */
  packageRoot?: string;
};

export function resetToolchainImages(options: ResolveToolchainImageOptions = {}): void {
  toolchainImages.clear();
  const dir = registryDir(options.packageRoot ?? process.cwd());
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Clears the in-process cache without deleting persisted registry files. */
export function clearToolchainImageMemory(): void {
  toolchainImages.clear();
}

/**
 * Resolve a variant registered by `buildToolchainImage`.
 * Checks in-process memory first, then the packageRoot-scoped registry file
 * (so vitest `globalSetup` registrations are visible to test workers).
 */
export function resolveToolchainImage(
  agent: AgentName,
  variant: string,
  options: ResolveToolchainImageOptions = {},
): string | undefined {
  const packageRoot = resolve(options.packageRoot ?? process.cwd());
  const key = registryKey(agent, variant);
  const cacheKey = `${digest(packageRoot)}::${key}`;
  const cached = toolchainImages.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const file = registryEntryPath(packageRoot, agent, variant);
  if (!existsSync(file)) {
    return undefined;
  }

  const image = readFileSync(file, "utf8").trim();
  if (image.length === 0) {
    return undefined;
  }

  toolchainImages.set(cacheKey, image);
  return image;
}

export async function buildToolchainImage(
  variant: string,
  options: BuildToolchainImageOptions,
): Promise<void> {
  const packageRoot = resolve(options.packageRoot ?? process.cwd());
  const dockerfile = join(packageRoot, options.dockerfileRelative);
  const dockerRunner = options.dockerRunner ?? runDocker;
  const agentImage = resolveAgent(options.agent).image;

  if (!existsSync(dockerfile)) {
    throw new Error(`Dockerfile not found at ${dockerfile}`);
  }

  const dockerfileContents = readFileSync(dockerfile, "utf8");
  assertDockerfileUsesAgentImage(dockerfileContents, agentImage);

  await buildAgentImage(options.agent);

  const parentId = await inspectImageId(agentImage, dockerRunner);
  const repoDigest = digest(packageRoot);
  const contentDigest = digest(`${dockerfileContents}\n${parentId}`);
  const image = `agent-gwt/toolchain-${options.agent}-${repoDigest}:${contentDigest}`;

  await buildDockerImage(image, {
    dockerfileRelative: options.dockerfileRelative,
    packageRoot,
    force: true,
    buildArgs: { [AGENT_IMAGE_BUILD_ARG]: agentImage },
    ...(options.dockerRunner !== undefined ? { dockerRunner: options.dockerRunner } : {}),
  });

  registerToolchainImage(packageRoot, options.agent, variant, image);
}

function registerToolchainImage(
  packageRoot: string,
  agent: AgentName,
  variant: string,
  image: string,
): void {
  const key = registryKey(agent, variant);
  const cacheKey = `${digest(packageRoot)}::${key}`;
  toolchainImages.set(cacheKey, image);

  const file = registryEntryPath(packageRoot, agent, variant);
  mkdirSync(registryDir(packageRoot), { recursive: true });
  const temp = `${file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(temp, `${image}\n`);
  renameSync(temp, file);
}

function assertDockerfileUsesAgentImage(contents: string, agentImage: string): void {
  // Single-stage only: first FROM must be the agent (multi-stage final-FROM layouts are out of scope).
  const fromLine = contents
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^FROM\s+/i.test(line));

  if (fromLine === undefined) {
    throw new Error(
      `Dockerfile must start FROM ${agentImage} or FROM \${${AGENT_IMAGE_BUILD_ARG}}`,
    );
  }

  const usesBuildArg =
    fromLine.includes(`\${${AGENT_IMAGE_BUILD_ARG}}`) ||
    fromLine.includes(`$${AGENT_IMAGE_BUILD_ARG}`);
  const usesLiteral = fromLine.includes(agentImage);

  if (!usesBuildArg && !usesLiteral) {
    throw new Error(
      `Dockerfile FROM must resolve to ${agentImage} ` +
        `(use FROM ${agentImage} or ARG ${AGENT_IMAGE_BUILD_ARG} / FROM \${${AGENT_IMAGE_BUILD_ARG}}). ` +
        `Got: ${fromLine}`,
    );
  }
}

async function inspectImageId(image: string, dockerRunner: DockerRunner): Promise<string> {
  const inspect = await dockerRunner(["image", "inspect", "--format", "{{.Id}}", image]);
  if (inspect.exitCode !== 0) {
    throw new Error(
      `Docker image ${image} not found after buildAgentImage. stderr:\n${inspect.stderr}`,
    );
  }

  const id = inspect.stdout.trim();
  if (id.length === 0) {
    throw new Error(`Docker image inspect returned an empty Id for ${image}`);
  }

  return id;
}

function registryKey(agent: AgentName, variant: string): string {
  return `${agent}::${variant}`;
}

function registryDir(packageRoot: string): string {
  return join(tmpdir(), ".agents-gwt", "toolchains", digest(resolve(packageRoot)));
}

function registryEntryPath(packageRoot: string, agent: AgentName, variant: string): string {
  // Hash the raw key so distinct variants never collide on disk (e.g. node/18 vs node_18).
  return join(registryDir(packageRoot), digest(registryKey(agent, variant)));
}

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex").slice(0, DIGEST_LENGTH);
}
