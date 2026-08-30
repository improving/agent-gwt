import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import { expect } from "vitest";

export type CopyToWorkspaceOptions = {
  readonly from?: string;
  readonly base?: string;
};

export async function copy_to_workspace(
  workspace: string,
  globs: readonly string[],
  options?: CopyToWorkspaceOptions,
): Promise<void> {
  const from = resolveSourceRoot(options);
  const base = options?.base;
  const copies: Array<{ source: string; destination: string }> = [];
  const destinations = new Set<string>();

  for (const glob of globs) {
    const matches = await expandGlob(from, glob);
    if (matches.length === 0) {
      throw new Error(`copy_to_workspace: glob "${glob}" matched no files under ${from}`);
    }

    for (const relativePath of matches) {
      const destinationRelative = base === undefined ? relativePath : stripBase(relativePath, base);
      if (destinations.has(destinationRelative)) {
        continue;
      }
      destinations.add(destinationRelative);
      copies.push({
        source: join(from, relativePath),
        destination: join(workspace, destinationRelative),
      });
    }
  }

  for (const { source, destination } of copies) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}

function resolveSourceRoot(options: CopyToWorkspaceOptions | undefined): string {
  const from = options?.from;
  if (from !== undefined) {
    return resolve(from);
  }

  const testPath = expect.getState().testPath;
  if (testPath === undefined || testPath === "") {
    throw new Error(
      "copy_to_workspace: cannot resolve the spec directory; pass options.from or call from a Vitest test",
    );
  }

  return dirname(testPath);
}

async function expandGlob(from: string, glob: string): Promise<string[]> {
  const matcher = globToRegExp(glob);
  const names = await readdir(from, { recursive: true });
  const matches: string[] = [];

  for (const name of names) {
    const relativePath = name.split(sep).join("/");
    const absolutePath = join(from, name);
    if (!isInsideRoot(from, absolutePath)) {
      throw new Error(`copy_to_workspace: matched path escapes source root: ${absolutePath}`);
    }

    const info = await stat(absolutePath);
    if (!info.isFile() || !matcher.test(relativePath)) {
      continue;
    }

    matches.push(relativePath);
  }

  return matches;
}

function isInsideRoot(from: string, absolutePath: string): boolean {
  const rel = relative(from, absolutePath);
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !rel.startsWith("../");
}

function stripBase(relativePath: string, base: string): string {
  const pathSegments = relativePath.split("/");
  const baseSegments = base
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment !== "");

  if (!matchesBasePrefix(pathSegments, baseSegments)) {
    throw new Error(`copy_to_workspace: path "${relativePath}" does not match base "${base}"`);
  }

  const destinationSegments = pathSegments.slice(baseSegments.length);
  if (
    destinationSegments.length === 0 ||
    destinationSegments.some((segment) => segment === "" || segment === "..")
  ) {
    throw new Error(
      `copy_to_workspace: stripping base "${base}" from "${relativePath}" left an empty destination`,
    );
  }

  return destinationSegments.join("/");
}

function matchesBasePrefix(
  pathSegments: readonly string[],
  baseSegments: readonly string[],
): boolean {
  if (pathSegments.length <= baseSegments.length) {
    return false;
  }

  for (const [index, baseSegment] of baseSegments.entries()) {
    const pathSegment = pathSegments[index];
    if (pathSegment === undefined) {
      return false;
    }
    if (baseSegment !== "*" && baseSegment !== pathSegment) {
      return false;
    }
  }

  return true;
}

function globToRegExp(glob: string): RegExp {
  const pattern = glob.replaceAll("\\", "/");
  let regex = "^";
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index];
    if (char === undefined) {
      break;
    }

    if (char === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        regex += "(?:.*/)?";
        index += 3;
        continue;
      }

      regex += ".*";
      index += 2;
      continue;
    }

    if (char === "*") {
      regex += "[^/]*";
      index += 1;
      continue;
    }

    if (char === "?") {
      regex += "[^/]";
      index += 1;
      continue;
    }

    regex += escapeRegExp(char);
    index += 1;
  }

  return new RegExp(`${regex}$`);
}

function escapeRegExp(char: string): string {
  return char.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
