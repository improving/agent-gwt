import { CONTAINER_HOME } from "clanker-cleanroom";

export const COPILOT_IMAGE = "clanker-cleanroom/copilot";

/** Directory Copilot CLI stores config/auth in (also the `COPILOT_HOME` default). */
export const CONTAINER_COPILOT_HOME = `${CONTAINER_HOME}/.copilot`;

/** Host token env vars, in the CLI's own precedence order. */
export const COPILOT_TOKEN_ENVS = ["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"] as const;

/** Linux hosts may persist credentials here; macOS uses the Keychain instead. */
export const defaultHostCopilotHome = (home: string): string => `${home}/.copilot`;
