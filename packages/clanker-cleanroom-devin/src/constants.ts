import { CONTAINER_HOME } from "clanker-cleanroom";

export const DEVIN_IMAGE = "clanker-cleanroom/devin";

/** Container path where the host `credentials.toml` is bind-mounted read-only. */
export const DEVIN_CONTAINER_CREDENTIALS_PATH = `${CONTAINER_HOME}/.local/share/devin/credentials.toml`;

/**
 * Devin API key forwarded to the container by env name (never on argv). When set,
 * it takes precedence over a bind-mounted host `credentials.toml`.
 */
export const DEVIN_API_KEY_ENV = "DEVIN_API_KEY";

/** Host path of the token written by `devin auth login` (macOS/Linux). */
export const defaultDevinHostCredentialsFile = (home: string): string =>
  `${home}/.local/share/devin/credentials.toml`;
