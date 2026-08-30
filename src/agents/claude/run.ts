import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir } from "node:os";

import { CONTAINER_HOME, CONTAINER_WORKSPACE } from "../base/constants.js";
import { buildDockerRunArgs, runDocker } from "../docker.js";
import { parseAgentJsonOutput } from "../parse-result.js";
import { agentRunError } from "../run-error.js";
import type { AgentRunBindingsOptions, DockerRunner, DockerVolumeMount } from "../types.js";
import {
  CLAUDE_API_KEY_ENV,
  CLAUDE_CONTAINER_CREDENTIALS_PATH,
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

export type RunClaudeInDockerOptions = AgentRunBindingsOptions & {
  /** Defaults to `resolveClaudeCredentials()`. */
  credentials?: ClaudeCredentials;
  uid?: number;
  gid?: number;
};

/** The parts of `claude -p --output-format json` stdout most tests care about. */
export type ClaudeAgentResult = {
  type: "result";
  subtype: string;
  is_error: boolean;
  result: string;
  session_id: string;
  num_turns: number;
  duration_ms: number;
  total_cost_usd: number;
  stop_reason?: string;
  terminal_reason?: string;
  permission_denials?: unknown[];
  usage?: Record<string, unknown>;
};

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

export function buildClaudeDockerArgs(options: {
  workspace: string;
  prompt: string;
  image: string;
  credentials: ClaudeCredentials;
  uid: number;
  gid: number;
  model?: string;
}): string[] {
  const claudeArgs = ["claude", "-p", "--output-format", "json", "--dangerously-skip-permissions"];

  if (options.model !== undefined && options.model !== "") {
    claudeArgs.push("--model", options.model);
  }

  claudeArgs.push("--", options.prompt);

  const volumes: DockerVolumeMount[] = [
    { host: options.workspace, container: CONTAINER_WORKSPACE },
  ];

  if (options.credentials.kind === "credentials-file") {
    volumes.push({
      host: options.credentials.file,
      container: CLAUDE_CONTAINER_CREDENTIALS_PATH,
      mode: "ro",
    });
  }

  return buildDockerRunArgs({
    image: options.image,
    uid: options.uid,
    gid: options.gid,
    workdir: CONTAINER_WORKSPACE,
    env: { HOME: CONTAINER_HOME },
    // Names only; the values reach the container through the docker CLI's own environment.
    envPassthrough: Object.keys(credentialsEnv(options.credentials)),
    volumes,
    command: claudeArgs,
  });
}

export async function runClaudeInDocker(
  options: RunClaudeInDockerOptions,
  dockerRunner: DockerRunner = runDocker,
): Promise<unknown> {
  const credentials = options.credentials ?? (await resolveClaudeCredentials());
  const uid = options.uid ?? process.getuid?.() ?? 0;
  const gid = options.gid ?? process.getgid?.() ?? 0;

  const args = buildClaudeDockerArgs({
    workspace: options.workspace,
    prompt: options.prompt,
    image: options.image,
    credentials,
    uid,
    gid,
    ...(options.model !== undefined ? { model: options.model } : {}),
  });

  const result = await dockerRunner(args, { env: credentialsEnv(credentials) });

  if (result.exitCode !== 0) {
    throw agentRunError({
      agent: "Claude",
      name: "claude",
      image: options.image,
      result,
      detail: reportedErrorMessage(result.stdout),
    });
  }

  const parsed = parseAgentJsonOutput(result.stdout);

  if (isErrorResult(parsed)) {
    throw new Error(`Claude agent reported an error: ${describeErrorResult(parsed)}`);
  }

  return parsed;
}

/** Secret values for the docker CLI process, keyed by the env names `buildClaudeDockerArgs` forwards. */
function credentialsEnv(credentials: ClaudeCredentials): Record<string, string> {
  switch (credentials.kind) {
    case "oauth-token":
      return { [CLAUDE_OAUTH_TOKEN_ENV]: credentials.token };
    case "api-key":
      return { [CLAUDE_API_KEY_ENV]: credentials.apiKey };
    case "credentials-file":
      return {};
  }
}

function isErrorResult(value: unknown): value is ClaudeAgentResult {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { is_error?: unknown }).is_error === true
  );
}

/** Claude prints its JSON result even when it fails; surface the human-readable part. */
function reportedErrorMessage(stdout: string): string | undefined {
  try {
    const parsed = parseAgentJsonOutput(stdout);
    return isErrorResult(parsed) ? describeErrorResult(parsed) : undefined;
  } catch {
    return undefined;
  }
}

/** `terminal_reason` (e.g. `api_error`) is the useful label; `subtype` can read `success` even when `is_error` is true. */
function describeErrorResult(result: ClaudeAgentResult): string {
  const message = String(result.result);

  if (result.terminal_reason !== undefined && result.terminal_reason !== "completed") {
    return `${result.terminal_reason}: ${message}`;
  }

  if (result.subtype !== "success") {
    return `${result.subtype}: ${message}`;
  }

  return message;
}
