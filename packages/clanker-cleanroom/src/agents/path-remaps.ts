/** Absolute path prefix map: container-local prefix → host (or parent) path. */
export type Remaps = Readonly<Record<string, string>>;

/** Env injected into nested cleanroom containers so descendant Agent.run calls can rewrite mounts. */
export const CLANKER_PATH_REMAPS_ENV = "CLANKER_PATH_REMAPS";

/**
 * Rewrite `hostPath` by replacing the longest matching remap key prefix with its value.
 * Keys are absolute; match is only at the start (`^key` with a path boundary).
 */
export function applyPathRemaps(hostPath: string, remaps: Remaps | undefined): string {
  if (remaps === undefined) {
    return hostPath;
  }

  const keys = Object.keys(remaps).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const value = remaps[key];
    if (value === undefined) {
      continue;
    }
    if (hostPath === key) {
      return value;
    }
    if (hostPath.startsWith(`${key}/`)) {
      return `${value}${hostPath.slice(key.length)}`;
    }
  }

  return hostPath;
}

/**
 * Merge remaps for a child container: keep inherited entries, then add `next` with
 * values rewritten through `inherited` so every nesting level maps to the root host.
 */
export function composeRemaps(inherited: Remaps, next: Remaps): Remaps {
  const out: Record<string, string> = { ...inherited };
  for (const [key, value] of Object.entries(next)) {
    out[key] = applyPathRemaps(value, inherited);
  }
  return out;
}

/** Parse inherited remaps from the process environment (empty if unset/invalid). */
export function readInheritedRemaps(env: NodeJS.ProcessEnv = process.env): Remaps {
  const raw = env[CLANKER_PATH_REMAPS_ENV];
  if (raw === undefined || raw === "") {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const remaps: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        remaps[key] = value;
      }
    }
    return remaps;
  } catch {
    return {};
  }
}

export function serializeRemaps(remaps: Remaps): string {
  return JSON.stringify(remaps);
}

export function remapsAreEmpty(remaps: Remaps): boolean {
  return Object.keys(remaps).length === 0;
}
