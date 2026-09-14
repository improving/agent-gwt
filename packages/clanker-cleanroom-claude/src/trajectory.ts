import {
  asRecord,
  extractTextContent,
  readString,
  readTokenCount,
  type TrajectoryEvent,
} from "clanker-cleanroom";

export function adaptClaudeEvents(rawEvents: readonly unknown[]): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];

  for (const raw of rawEvents) {
    const record = asRecord(raw);
    if (record === undefined) {
      events.push({ kind: "other", type: "unknown", raw });
      continue;
    }

    const type = readString(record.type) ?? "unknown";

    switch (type) {
      case "system":
        events.push({
          kind: "system",
          sessionId: readString(record.session_id),
          model: readString(record.model),
          raw,
        });
        break;
      case "user":
        events.push(...adaptClaudeUser(record, raw));
        break;
      case "assistant":
        events.push(...adaptClaudeAssistant(record, raw));
        break;
      case "result":
        events.push({
          kind: "result",
          text: readString(record.result) ?? "",
          isError: record.is_error === true,
          durationMs: readTokenCount(record.duration_ms),
          costUsd: readTokenCount(record.total_cost_usd),
          raw,
        });
        break;
      default:
        events.push({ kind: "other", type, raw });
    }
  }

  return events;
}

function adaptClaudeAssistant(
  record: Record<string, unknown>,
  raw: unknown,
): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];
  const text = extractTextContent(record.message);
  if (text !== "") {
    events.push({ kind: "assistant", text, raw });
  }

  for (const block of contentBlocks(record.message)) {
    if (block.type !== "tool_use") {
      continue;
    }
    events.push({
      kind: "tool",
      phase: "started",
      callId: readString(block.id) ?? "",
      name: readString(block.name) ?? "unknown",
      args: block.input ?? null,
      result: null,
      raw,
    });
  }

  if (events.length === 0) {
    events.push({ kind: "assistant", text: "", raw });
  }

  return events;
}

function adaptClaudeUser(record: Record<string, unknown>, raw: unknown): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];
  const text = extractTextContent(record.message);
  const toolResults: TrajectoryEvent[] = [];

  for (const block of contentBlocks(record.message)) {
    if (block.type !== "tool_result") {
      continue;
    }
    toolResults.push({
      kind: "tool",
      phase: "completed",
      callId: readString(block.tool_use_id) ?? "",
      name: "tool_result",
      args: null,
      result: block.content ?? null,
      raw,
    });
  }

  if (text !== "" || toolResults.length === 0) {
    events.push({ kind: "user", text, raw });
  }
  events.push(...toolResults);
  return events;
}

function contentBlocks(message: unknown): Record<string, unknown>[] {
  const content = asRecord(message)?.content;
  if (!Array.isArray(content)) {
    return [];
  }
  return content.map((block) => asRecord(block)).filter((block) => block !== undefined);
}
