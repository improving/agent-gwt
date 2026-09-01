import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const IMAGES_REGISTRY_FILENAME = "clanker-cleanroom.images.json";

export type ImageRegistryEntry = {
  image: string;
  dockerfile: string;
  builtAt: string;
};

export type ImageRegistry = {
  version: 1;
  images: Record<string, ImageRegistryEntry>;
};

export type RegistryOptions = {
  /** Directory that owns the registry file. Defaults to `process.cwd()`. */
  packageRoot?: string;
};

export function registryPath(options: RegistryOptions = {}): string {
  return join(resolve(options.packageRoot ?? process.cwd()), IMAGES_REGISTRY_FILENAME);
}

export function readRegistry(options: RegistryOptions = {}): ImageRegistry {
  const file = registryPath(options);
  if (!existsSync(file)) {
    return { version: 1, images: {} };
  }

  const parsed = JSON.parse(readFileSync(file, "utf8")) as ImageRegistry;
  if (parsed.version !== 1 || typeof parsed.images !== "object" || parsed.images === null) {
    throw new Error(`Invalid image registry at ${file}`);
  }

  return parsed;
}

export function writeRegistry(registry: ImageRegistry, options: RegistryOptions = {}): void {
  const file = registryPath(options);
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(registry, null, 2)}\n`);
  renameSync(temp, file);
}

export function upsertRegistryEntry(
  tag: string,
  entry: ImageRegistryEntry,
  options: RegistryOptions = {},
): void {
  const registry = readRegistry(options);
  registry.images[tag] = entry;
  writeRegistry(registry, options);
}

export function resolveImage(tag: string, options: RegistryOptions = {}): string | undefined {
  return readRegistry(options).images[tag]?.image;
}

export function resetRegistry(options: RegistryOptions = {}): void {
  const file = registryPath(options);
  if (existsSync(file)) {
    writeFileSync(file, `${JSON.stringify({ version: 1, images: {} } satisfies ImageRegistry, null, 2)}\n`);
  }
}
