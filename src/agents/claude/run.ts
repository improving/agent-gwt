import { runDocker } from "../docker.js";
import { parseAgentJsonOutput } from "../parse-result.js";
import { agentRunError } from "../run-error.js";
import type { AgentRunBindingsOptions, DockerRunner } from "../types.js";
import { buildClaudeDockerArgs } from "./_buildDockerArgs.js";
import { credentialsEnv } from "./_credentialsEnv.js";
import { type ClaudeCredentials, resolveClaudeCredentials } from "./_resolveCredentials.js";

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
