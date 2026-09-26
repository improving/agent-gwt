import {
  asRecord,
  readString,
  readTokenCount,
  type TrajectoryEvent,
} from "clanker-cleanroom";

/**
 * Adapt raw Devin CLI ATIF export documents (Agent Trajectory Interchange Format)
 * into normalized trajectory events. Unlike the other agents, Devin's trajectory
 * is a single JSON object with a `steps` array, not an NDJSON event stream.
 */
export function adaptDevinEvents(rawEvents: readonly unknown[]): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];

  for (const raw of rawEvents) {
    const record = asRecord(raw);
    const steps = record?.steps;
    if (!Array.isArray(steps)) {
      events.push({ kind: "other", type: readString(record?.schema_version) ?? "unknown", raw });
      continue;
    }
    events.push(...adaptAtifTrajectory(record, raw));
  }

  return events;
}

function adaptAtifTrajectory(record: Record<string, unknown>, raw: unknown): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];
  const model = readString(asRecord(record.agent)?.model_name);

  events.push({
    kind: "system",
    sessionId: readString(record.session_id),
    model,
    raw,
  });

  for (const step of stepsOf(record)) {
    const source = readString(step.source) ?? "unknown";
    const text = stepMessage(step);

    if (source === "user") {
      events.push({ kind: "user", text, raw });
      continue;
    }

    if (source === "agent") {
      if (text !== "") {
        events.push({ kind: "assistant", text, raw });
      }
      events.push(...adaptAtifToolCalls(step, raw));
      continue;
    }

    events.push({ kind: "other", type: source, raw });
  }

  events.push(...adaptAtifResult(record, raw));
  return events;
}

function adaptAtifToolCalls(
  step: Record<string, unknown>,
  raw: unknown,
): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];
  const calls = step.tool_calls;
  if (!Array.isArray(calls)) {
    return events;
  }

  for (const call of calls) {
    const record = asRecord(call);
    if (record === undefined) {
      continue;
    }
    events.push({
      kind: "tool",
      phase: "started",
      callId: readString(record.tool_call_id) ?? "",
      name: readString(record.function_name) ?? "unknown",
      args: record.arguments ?? null,
      result: null,
      raw,
    });
  }

  return events;
}

/**
 * ATIF reports tool output in each step's `observation.results`; map each result
 * to a completed tool event keyed by `tool_call_id`.
 */
function adaptAtifResult(record: Record<string, unknown>, raw: unknown): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];
  const finalMetrics = asRecord(record.final_metrics);

  let lastAgentText: string | null = null;
  for (const step of stepsOf(record)) {
    if (step.source === "agent") {
      lastAgentText = stepMessage(step);
    }
    for (const observation of observationsOf(step)) {
      events.push({
        kind: "tool",
        phase: "completed",
        callId: readString(observation.tool_call_id) ?? "",
        name: "tool_result",
        args: null,
        result: observation.content ?? null,
        raw,
      });
    }
  }

  events.push({
    kind: "result",
    text: lastAgentText ?? "",
    isError: false,
    durationMs: null,
    costUsd: readTokenCount(finalMetrics?.total_cost_usd),
    raw,
  });
  return events;
}

function stepsOf(record: Record<string, unknown>): Record<string, unknown>[] {
  const steps = record.steps;
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.map((step) => asRecord(step)).filter((step) => step !== undefined);
}

function observationsOf(step: Record<string, unknown>): Record<string, unknown>[] {
  const observation = asRecord(step.observation);
  const results = observation?.results;
  if (!Array.isArray(results)) {
    return [];
  }
  return results.map((result) => asRecord(result)).filter((result) => result !== undefined);
}

/** ATIF `message` is a string or an array of content parts; extract the text. */
function stepMessage(step: Record<string, unknown>): string {
  const message = step.message;
  if (typeof message === "string") {
    return message;
  }
  if (Array.isArray(message)) {
    return message
      .map((part) => readString(asRecord(part)?.text) ?? "")
      .filter((text) => text !== "")
      .join("\n");
  }
  return "";
}
