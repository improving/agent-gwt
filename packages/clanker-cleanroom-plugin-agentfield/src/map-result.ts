import {
  createHarnessResult,
  type HarnessResult,
} from "@agentfield/sdk";
import type { AgentRunResult, Trajectory, TrajectoryEvent } from "clanker-cleanroom";

function nullToUndefined(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function eventToMessage(event: TrajectoryEvent): Record<string, unknown> {
  const { raw, ...rest } = event;
  return {
    ...rest,
    ...(raw !== undefined ? { raw } : {}),
  };
}

function countTurns(trajectory: Trajectory | null): number {
  if (trajectory === null) {
    return 0;
  }
  let turns = 0;
  for (const event of trajectory.events) {
    if (event.kind === "assistant") {
      turns += 1;
    } else if (event.kind === "tool" && event.phase === "completed") {
      turns += 1;
    }
  }
  return turns;
}

function resultText(run: AgentRunResult, trajectory: Trajectory | null): string | undefined {
  const resultEvent = trajectory?.result();
  if (resultEvent !== undefined && resultEvent !== null && resultEvent.text.length > 0) {
    return resultEvent.text;
  }
  const assistants = trajectory?.assistantMessages() ?? [];
  const last = assistants.at(-1);
  if (last !== undefined && last.length > 0) {
    return last;
  }
  void run;
  return undefined;
}

export type MapRunToHarnessInput = {
  run: AgentRunResult;
  trajectory: Trajectory | null;
  sessionId: string | null;
  durationMsOverride?: number;
  isError?: boolean;
  errorMessage?: string;
  failureType?: HarnessResult["failureType"];
  parsed?: unknown;
};

export function mapRunToHarnessResult(input: MapRunToHarnessInput): HarnessResult {
  const { run, trajectory, sessionId } = input;
  const inputTokens = nullToUndefined(run.usage.inputTokens);
  const outputTokens = nullToUndefined(run.usage.outputTokens);
  const cacheReadTokens = nullToUndefined(run.usage.cacheReadTokens);
  const cacheCreationTokens = nullToUndefined(run.usage.cacheWriteTokens);
  const totalTokens =
    inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined;

  const messages =
    trajectory === null ? [] : trajectory.events.map((event) => eventToMessage(event));

  const resultTextValue = resultText(run, trajectory);
  const durationMs =
    input.durationMsOverride ??
    nullToUndefined(run.durationMs) ??
    nullToUndefined(trajectory?.result()?.durationMs) ??
    0;

  return createHarnessResult({
    ...(resultTextValue !== undefined ? { result: resultTextValue } : {}),
    ...(input.parsed !== undefined ? { parsed: input.parsed } : {}),
    isError: input.isError ?? false,
    ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
    ...(input.failureType !== undefined ? { failureType: input.failureType } : {}),
    ...(nullToUndefined(run.costUsd) !== undefined ? { costUsd: run.costUsd! } : {}),
    numTurns: countTurns(trajectory),
    durationMs,
    sessionId: sessionId ?? "",
    messages,
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(cacheReadTokens !== undefined ? { cacheReadTokens } : {}),
    ...(cacheCreationTokens !== undefined ? { cacheCreationTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
  });
}
