import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type DockerfileEntry = {
  /** Absolute path to the Dockerfile. */
  file: string;
  /** Basename (e.g. `cursor.Dockerfile`). */
  relative: string;
  /** First-line tag / Docker image name (e.g. `clanker-cleanroom/cursor`). */
  tag: string;
  /** Tags from this folder that appear in FROM lines. */
  dependencies: string[];
};

const TAG_COMMENT = /^#\s*(\S+)\s*$/;
const FROM_LINE =
  /^FROM\s+(?:--platform=\S+\s+)?([^\s]+)(?:\s+AS\s+\S+)?\s*$/i;

/**
 * Discover `*.Dockerfile` files in `dir` and parse first-line tags + local FROM deps.
 */
export function parseDockerfiles(dir: string): DockerfileEntry[] {
  const names = readdirSync(dir).filter((name) => name.endsWith(".Dockerfile")).sort();
  if (names.length === 0) {
    throw new Error(`No *.Dockerfile files found in ${dir}`);
  }

  const entries: DockerfileEntry[] = [];
  const tags = new Set<string>();

  for (const name of names) {
    const file = join(dir, name);
    const contents = readFileSync(file, "utf8");
    const lines = contents.split(/\r?\n/);
    const first = lines[0] ?? "";
    const tagMatch = TAG_COMMENT.exec(first);
    if (tagMatch === null) {
      throw new Error(
        `Dockerfile ${name} must start with a tag comment "# <image>" (e.g. "# clanker-cleanroom/cursor"). Got: ${JSON.stringify(first)}`,
      );
    }

    const tag = tagMatch[1]!;
    if (tags.has(tag)) {
      throw new Error(`Duplicate Dockerfile tag "${tag}" in ${dir}`);
    }
    tags.add(tag);

    entries.push({
      file,
      relative: name,
      tag,
      dependencies: [],
    });
  }

  const tagSet = new Set(entries.map((entry) => entry.tag));

  for (const entry of entries) {
    const contents = readFileSync(entry.file, "utf8");
    const deps = new Set<string>();
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      const fromMatch = FROM_LINE.exec(trimmed);
      if (fromMatch === null) {
        continue;
      }
      const image = fromMatch[1]!;
      if (tagSet.has(image)) {
        deps.add(image);
      }
    }
    entry.dependencies = [...deps];
  }

  return entries;
}
