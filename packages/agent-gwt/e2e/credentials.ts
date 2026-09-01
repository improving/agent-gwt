import { existsSync } from "node:fs";
import { homedir } from "node:os";

import {
  CLAUDE_API_KEY_ENV,
  CLAUDE_OAUTH_TOKEN_ENV,
  defaultClaudeHostCredentialsFile,
  defaultHostAuthFile,
} from "../src/index.js";

/** Same sources as resolveClaudeCredentials(), as a sync yes/no for skip decisions. */
export function hasClaudeCredential(env: NodeJS.ProcessEnv = process.env): boolean {
  const token = env[CLAUDE_OAUTH_TOKEN_ENV];
  const apiKey = env[CLAUDE_API_KEY_ENV];

  return (
    (token !== undefined && token !== "") ||
    (apiKey !== undefined && apiKey !== "") ||
    existsSync(defaultClaudeHostCredentialsFile(homedir()))
  );
}

/** Same check runCursorInDocker() makes before it starts the container. */
export function hasCursorCredential(): boolean {
  return existsSync(defaultHostAuthFile(homedir()));
}
