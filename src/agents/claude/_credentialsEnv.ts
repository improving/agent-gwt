import type { ClaudeCredentials } from "./_resolveCredentials.js";
import { CLAUDE_API_KEY_ENV, CLAUDE_OAUTH_TOKEN_ENV } from "./constants.js";

/** Secret values for the docker CLI process, keyed by the env names `buildClaudeDockerArgs` forwards. */
export function credentialsEnv(credentials: ClaudeCredentials): Record<string, string> {
  switch (credentials.kind) {
    case "oauth-token":
      return { [CLAUDE_OAUTH_TOKEN_ENV]: credentials.token };
    case "api-key":
      return { [CLAUDE_API_KEY_ENV]: credentials.apiKey };
    case "credentials-file":
      return {};
  }
}
