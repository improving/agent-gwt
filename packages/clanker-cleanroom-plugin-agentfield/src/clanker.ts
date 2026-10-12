import type { HarnessResult } from "@agentfield/sdk";
import {
  Agent as CleanroomAgent,
  AgentAbortError,
  emptyTokenUsage,
  isAbortError,
  type AgentRunResult,
  type RunAgentOptions,
  type Trajectory,
} from "clanker-cleanroom";

import { mapRunToHarnessResult } from "./map-result.js";
import type { ClankerOptions } from "./options.js";
import { recordClankerUsage } from "./record-usage.js";
import { buildPromptSuffix, parseAndValidate } from "./schema.js";

/** Minimal cleanroom agent surface used by {@link clanker} (overridable in tests). */
export type CleanroomAgentLike = {
  run: (options: RunAgentOptions) => Promise<AgentRunResult>;
  trajectory: () => Promise<Trajectory>;
  sessionId: () => string | null;
};

export type ClankerDeps = {
  createAgent?: (name: string) => CleanroomAgentLike;
};

async function loadTrajectory(agent: CleanroomAgentLike): Promise<Trajectory | null> {
  try {
    return await agent.trajectory();
  } catch {
    return null;
  }
}

function emptyRunResult(): AgentRunResult {
  return {
    durationMs: null,
    costUsd: null,
    usage: emptyTokenUsage(),
  };
}

/**
 * Run a clanker-cleanroom agent and return an AgentField {@link HarnessResult}.
 * Records harness-style usage onto the current execution when present.
 */
export async function clanker(
  prompt: string,
  options: ClankerOptions,
  deps: ClankerDeps = {},
): Promise<HarnessResult> {
  const createAgent =
    deps.createAgent ?? ((name: string): CleanroomAgentLike => new CleanroomAgent(name));
  const agent: CleanroomAgentLike = createAgent(options.agent);

  const effectivePrompt =
    options.schema === undefined ? prompt : `${prompt}${buildPromptSuffix(options.workspace)}`;

  const startedAt = Date.now();
  let run: AgentRunResult;
  let isError = false;
  let errorMessage: string | undefined;
  let failureType: HarnessResult["failureType"] | undefined;

  try {
    run = await agent.run({
      workspace: options.workspace,
      prompt: effectivePrompt,
      ...(options.model !== undefined ? { model: options.model } : {}),
      ...(options.image !== undefined ? { image: options.image } : {}),
      ...(options.remaps !== undefined ? { remaps: options.remaps } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
  } catch (error: unknown) {
    isError = true;
    errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof AgentAbortError || isAbortError(error)) {
      failureType = "none";
      const abortResult =
        error instanceof AgentAbortError
          ? error.result
          : ((error as { result?: AgentRunResult }).result ?? emptyRunResult());
      run = abortResult;
    } else {
      run = emptyRunResult();
    }
  }

  const trajectory = await loadTrajectory(agent);
  const sessionId = agent.sessionId();

  let parsed: unknown | undefined;
  if (options.schema !== undefined && !isError) {
    const validated = parseAndValidate(options.workspace, options.schema);
    if (validated === null) {
      isError = true;
      errorMessage = "Schema validation failed after parse and cosmetic repair attempts.";
      failureType = "schema";
    } else {
      parsed = validated;
    }
  }

  const result = mapRunToHarnessResult({
    run,
    trajectory,
    sessionId,
    durationMsOverride: nullToDuration(run.durationMs, startedAt),
    isError,
    ...(errorMessage !== undefined ? { errorMessage } : {}),
    ...(failureType !== undefined ? { failureType } : {}),
    ...(parsed !== undefined ? { parsed } : {}),
  });

  recordClankerUsage(result, {
    agent: options.agent,
    ...(options.model !== undefined ? { model: options.model } : {}),
  });

  return result;
}

function nullToDuration(durationMs: number | null, startedAt: number): number {
  if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
    return durationMs;
  }
  return Math.max(0, Date.now() - startedAt);
}
