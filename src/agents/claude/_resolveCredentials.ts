import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";

import {
  CLAUDE_API_KEY_ENV,
  CLAUDE_OAUTH_TOKEN_ENV,
  defaultClaudeHostCredentialsFile,
} from "./constants.js";

/**
 * How Claude Code authenticates inside the container. Env-backed kinds are forwarded
 * to `docker run` by name (never on argv); the file kind is bind-mounted read-only.
 * See `constants.ts` for which host setups produce each.
 */
export type ClaudeCredentials =
  | { kind: "oauth-token"; token: string }
  | { kind: "api-key"; apiKey: string }
  | { kind: "credentials-file"; file: string };

/** Env OAuth token, then env API key, then a readable host credentials file. */
export async function resolveClaudeCredentials(
  options: { env?: NodeJS.ProcessEnv; home?: string } = {},
): Promise<ClaudeCredentials> {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();

  const token = env[CLAUDE_OAUTH_TOKEN_ENV];
  if (token !== undefined && token !== "") {
    return { kind: "oauth-token", token };
  }

  const apiKey = env[CLAUDE_API_KEY_ENV];
  if (apiKey !== undefined && apiKey !== "") {
    return { kind: "api-key", apiKey };
  }

  const file = defaultClaudeHostCredentialsFile(home);
  try {
    await access(file, fsConstants.R_OK);
  } catch {
    throw new Error(
      `Claude Code credentials not found. Set ${CLAUDE_OAUTH_TOKEN_ENV} (run \`claude setup-token\` on the host) ` +
        `or ${CLAUDE_API_KEY_ENV}, or provide ${file} (Linux hosts; macOS keeps credentials in the Keychain).`,
    );
  }

  return { kind: "credentials-file", file };
}
