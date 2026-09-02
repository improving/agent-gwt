import { CONTAINER_HOME } from "../base/constants.js";

export const CLAUDE_IMAGE = "clanker-cleanroom/claude";
export const CLAUDE_CONTAINER_CREDENTIALS_PATH = `${CONTAINER_HOME}/.claude/.credentials.json`;

/** Long-lived OAuth token from `claude setup-token` (Claude subscription). */
export const CLAUDE_OAUTH_TOKEN_ENV = "CLAUDE_CODE_OAUTH_TOKEN";
/** Anthropic API key (pay-as-you-go). */
export const CLAUDE_API_KEY_ENV = "ANTHROPIC_API_KEY";

/** Linux hosts persist OAuth credentials here; macOS uses the Keychain instead. */
export const defaultClaudeHostCredentialsFile = (home: string): string =>
  `${home}/.claude/.credentials.json`;
