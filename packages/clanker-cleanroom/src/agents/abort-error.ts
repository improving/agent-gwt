import type { AgentRunResult } from "./types.js";
import { emptyTokenUsage } from "./types.js";

/** Thrown when an agent run is cancelled via `AbortSignal`. */
export class AgentAbortError extends Error {
  override readonly name = "AbortError";
  readonly result: AgentRunResult;

  constructor(result: AgentRunResult, message = "Agent run aborted") {
    super(message);
    this.result = result;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}

/** Best-effort metrics when a run is aborted mid-flight. */
export function tryParseAbortedResult(
  parseResult: (trajectory: string) => AgentRunResult,
  trajectory: string,
  startedAtMs: number,
): AgentRunResult {
  try {
    return parseResult(trajectory);
  } catch {
    return {
      durationMs: Math.max(0, Date.now() - startedAtMs),
      costUsd: null,
      usage: emptyTokenUsage(),
    };
  }
}
