import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";

import { buildAgentImage, buildDockerImage } from "./build-agent-image.js";
import type { AgentName } from "./registry.js";
import type { DockerRunner } from "./types.js";

const DIGEST_LENGTH = 12;

const toolchainImages = new Map<string, string>();

export type BuildToolchainImageOptions = {
  agent: AgentName;
  dockerfileRelative: string;
  /** Defaults to `process.cwd()` (consuming repo). */
  packageRoot?: string;
  dockerRunner?: DockerRunner;
};

export function resetToolchainImages(): void {
  const file = registryFilePath();
  const persisted = readRegistryFile();
  for (const key of toolchainImages.keys()) {
    delete persisted[key];
  }
  toolchainImages.clear();

  if (Object.keys(persisted).length === 0) {
    if (existsSync(file)) {
      rmSync(file, { force: true });
    }
    return;
  }

  writeRegistryFile(persisted);
}

/** Clears the in-process cache without deleting the persisted registry file. */
export function clearToolchainImageMemory(): void {
  toolchainImages.clear();
}

/**
 * Resolve a variant registered by `buildToolchainImage`.
 * Checks in-process memory first, then the cwd-scoped registry file
 * (so vitest `globalSetup` registrations are visible to test workers).
 */
export function resolveToolchainImage(agent: AgentName, variant: string): string | undefined {
  const key = registryKey(agent, variant);
  const cached = toolchainImages.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const persisted = readRegistryFile();
  const image = persisted[key];
  if (image === undefined) {
    return undefined;
  }

  toolchainImages.set(key, image);
  return image;
}

export async function buildToolchainImage(
  variant: string,
  options: BuildToolchainImageOptions,
): Promise<void> {
  const packageRoot = resolve(options.packageRoot ?? process.cwd());
  const dockerfile = join(packageRoot, options.dockerfileRelative);

  if (!existsSync(dockerfile)) {
    throw new Error(`Dockerfile not found at ${dockerfile}`);
  }

  await buildAgentImage(options.agent);

  const contentDigest = digest(readFileSync(dockerfile));
  const repoDigest = digest(packageRoot);
  const image = `agent-gwt/toolchain-${options.agent}-${repoDigest}:${contentDigest}`;

  await buildDockerImage(image, {
    dockerfileRelative: options.dockerfileRelative,
    packageRoot,
    ...(options.dockerRunner !== undefined ? { dockerRunner: options.dockerRunner } : {}),
  });

  registerToolchainImage(options.agent, variant, image);
}

function registerToolchainImage(agent: AgentName, variant: string, image: string): void {
  const key = registryKey(agent, variant);
  toolchainImages.set(key, image);

  const persisted = readRegistryFile();
  persisted[key] = image;
  writeRegistryFile(persisted);
}

function registryKey(agent: AgentName, variant: string): string {
  return `${agent}::${variant}`;
}

function registryFilePath(): string {
  return join(tmpdir(), ".agent-gwt", "toolchains", digest(resolve(process.cwd())), "variants.json");
}

function readRegistryFile(): Record<string, string> {
  const file = registryFilePath();
  if (!existsSync(file)) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function writeRegistryFile(entries: Record<string, string>): void {
  const file = registryFilePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`);
}

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex").slice(0, DIGEST_LENGTH);
}
