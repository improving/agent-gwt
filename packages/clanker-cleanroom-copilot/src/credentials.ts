import { access, constants as fsConstants } from "node:fs/promises";
import { homedir } from "node:os";

import {
  COPILOT_TOKEN_ENVS,
  defaultHostCopilotHome,
} from "./constants.js";

/**
 * How Copilot CLI authenticates inside the container. An env token is forwarded
 * to `docker run` by name (never on argv); the directory kind is bind-mounted
 * read-only at the container's `COPILOT_HOME`.
 */
export type CopilotCredentials =
  | { kind: "token-env"; envVar: string; token: string }
  | { kind: "config-dir"; dir: string };

/** Host token env (CLI precedence order), then a readable host `~/.copilot` dir. */
export async function resolveCopilotCredentials(
  options: { env?: NodeJS.ProcessEnv; home?: string } = {},
): Promise<CopilotCredentials> {
  const env = options.env ?? process.env;
  const home = options.home ?? homedir();

  for (const name of COPILOT_TOKEN_ENVS) {
    const token = env[name];
    if (token !== undefined && token !== "") {
      return { kind: "token-env", envVar: name, token };
    }
  }

  const dir = defaultHostCopilotHome(home);
  try {
    await access(dir, fsConstants.R_OK);
  } catch {
    throw new Error(
      `Copilot CLI credentials not found. Set ${COPILOT_TOKEN_ENVS[0]} (or GH_TOKEN / GITHUB_TOKEN; ` +
        `a fine-grained PAT with the "Copilot Requests" permission), or run \`copilot login\` on the host ` +
        `to create ${dir} (Linux hosts; macOS keeps the token in the Keychain).`,
    );
  }

  return { kind: "config-dir", dir };
}

/** Secret values for the docker CLI process, keyed by env names forwarded via envPassthrough. */
export function credentialsEnv(credentials: CopilotCredentials): Record<string, string> {
  switch (credentials.kind) {
    case "token-env":
      return { [credentials.envVar]: credentials.token };
    case "config-dir":
      return {};
  }
}
