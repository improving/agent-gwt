import { parseAgentJsonOutput } from "../parse-result.js";
import type { AgentBinding, AgentRunResult, DockerVolumeMount } from "../types.js";
import { readTokenCount } from "../types.js";
import { CLAUDE_CONTAINER_CREDENTIALS_PATH, CLAUDE_IMAGE } from "./constants.js";
import { credentialsEnv, resolveClaudeCredentials } from "./credentials.js";

export const claudeBinding: AgentBinding = {
  image: CLAUDE_IMAGE,
  displayName: "Claude",
  command: ({ prompt, model }) => {
    const claudeArgs = [
      "claude",
      "-p",
      "--output-format",
      "json",
      "--dangerously-skip-permissions",
    ];
    if (model !== undefined && model !== "") {
      claudeArgs.push("--model", model);
    }
    claudeArgs.push("--", prompt);
    return claudeArgs;
  },
  prepare: async () => {
    const credentials = await resolveClaudeCredentials();
    const volumes: DockerVolumeMount[] = [];
    if (credentials.kind === "credentials-file") {
      volumes.push({
        host: credentials.file,
        container: CLAUDE_CONTAINER_CREDENTIALS_PATH,
        mode: "ro",
      });
    }
    return {
      volumes,
      env: credentialsEnv(credentials),
    };
  },
  parseResult: parseClaudeResult,
  describeFailure: describeClaudeFailure,
};

function parseClaudeResult(stdout: string): AgentRunResult {
  const parsed = parseAgentJsonOutput(stdout);
  if (isErrorResult(parsed)) {
    throw new Error(`Claude agent reported an error: ${describeErrorResult(parsed)}`);
  }

  const record = asRecord(parsed);
  const usage = asRecord(record?.usage);

  return {
    durationMs: readTokenCount(record?.duration_ms),
    costUsd: readTokenCount(record?.total_cost_usd),
    usage: {
      inputTokens: readTokenCount(usage?.input_tokens ?? usage?.inputTokens),
      outputTokens: readTokenCount(usage?.output_tokens ?? usage?.outputTokens),
      cacheReadTokens: readTokenCount(usage?.cache_read_input_tokens ?? usage?.cacheReadTokens),
      cacheWriteTokens: readTokenCount(
        usage?.cache_creation_input_tokens ?? usage?.cacheWriteTokens,
      ),
    },
  };
}

function describeClaudeFailure(stdout: string): string | undefined {
  try {
    const parsed = parseAgentJsonOutput(stdout);
    return isErrorResult(parsed) ? describeErrorResult(parsed) : undefined;
  } catch {
    return undefined;
  }
}

type ClaudeErrorResult = {
  is_error: true;
  result: string;
  subtype?: string;
  terminal_reason?: string;
};

function isErrorResult(value: unknown): value is ClaudeErrorResult {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { is_error?: unknown }).is_error === true
  );
}

function describeErrorResult(result: ClaudeErrorResult): string {
  const message = String(result.result);

  if (result.terminal_reason !== undefined && result.terminal_reason !== "completed") {
    return `${result.terminal_reason}: ${message}`;
  }

  if (result.subtype !== undefined && result.subtype !== "success") {
    return `${result.subtype}: ${message}`;
  }

  return message;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return value as Record<string, unknown>;
}
