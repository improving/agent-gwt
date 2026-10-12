import {
  deriveProvider,
  ExecutionContext,
  type HarnessResult,
} from "@agentfield/sdk";

/** Sanitize a cleanroom agent name for the harness field (`cursor:node` → `clanker_cursor_node`). */
export function harnessNameForAgent(agentName: string): string {
  const sanitized = agentName.replaceAll(/[^a-zA-Z0-9]+/g, "_").replaceAll(/^_|_$/g, "");
  return `clanker_${sanitized || "agent"}`;
}

/**
 * Record a clanker run into the current execution's CostTracker.
 * Mirrors AgentField's private `recordHarnessUsage`: skip empty entries, never throw.
 */
export function recordClankerUsage(
  result: HarnessResult,
  options: { agent: string; model?: string },
): void {
  try {
    const current = ExecutionContext.getCurrent();
    const tracker = current?.costTracker;
    if (!tracker) {
      return;
    }

    const inputTokens = result.inputTokens ?? 0;
    const outputTokens = result.outputTokens ?? 0;
    const cacheRead = result.cacheReadTokens ?? 0;
    const cacheCreation = result.cacheCreationTokens ?? 0;
    const reportedTotal = result.totalTokens ?? 0;
    const cost =
      typeof result.costUsd === "number" && Number.isFinite(result.costUsd) ? result.costUsd : null;

    if (
      !inputTokens &&
      !outputTokens &&
      !cacheRead &&
      !cacheCreation &&
      !reportedTotal &&
      cost === null
    ) {
      return;
    }

    const modelName = String(result.model ?? options.model ?? options.agent);

    tracker.record({
      model: modelName,
      inputTokens,
      outputTokens,
      totalTokens: reportedTotal || inputTokens + outputTokens,
      costUsd: cost,
      reasonerName: current.metadata.reasonerId ?? null,
      source: "harness",
      provider: deriveProvider(modelName),
      harness: harnessNameForAgent(options.agent),
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
      costSource: cost !== null ? "provider" : null,
    });
  } catch {
    // Best effort — never let usage recording fail the clanker call.
  }
}
