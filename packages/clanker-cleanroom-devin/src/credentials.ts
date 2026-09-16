import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";

import { DEVIN_API_KEY_ENV, defaultDevinHostCredentialsFile } from "./constants.js";

/**
 * How Devin CLI authenticates inside the container. The env-backed kind is forwarded
 * to `docker run` by name (never on argv); the file kind is bind-mounted read-only.
 */
export type DevinCredentials =
  | { kind: "api-key"; apiKey: string }
  | { kind: "credentials-file"; file: string };

/** Env API key, then a readable host `credentials.toml` (from `devin auth login`). */
export async function resolveDevinCredentials(
  options: { env?: NodeJS.ProcessEnv; home?: string } = {},
): Promise<DevinCredentials> {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();

  const apiKey = env[DEVIN_API_KEY_ENV];
  if (apiKey !== undefined && apiKey !== "") {
    return { kind: "api-key", apiKey };
  }

  const file = defaultDevinHostCredentialsFile(home);
  try {
    await access(file, fsConstants.R_OK);
  } catch {
    throw new Error(
      `Devin CLI credentials not found. Set ${DEVIN_API_KEY_ENV}, or run \`devin auth login\` ` +
        `on the host so ${file} exists.`,
    );
  }

  return { kind: "credentials-file", file };
}

/** Secret values for the docker CLI process, keyed by env names forwarded via envPassthrough. */
export function credentialsEnv(credentials: DevinCredentials): Record<string, string> {
  switch (credentials.kind) {
    case "api-key":
      return { [DEVIN_API_KEY_ENV]: credentials.apiKey };
    case "credentials-file":
      return {};
  }
}
