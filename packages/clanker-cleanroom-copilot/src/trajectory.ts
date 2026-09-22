import {
  asRecord,
  readString,
  readTokenCount,
  type TrajectoryEvent,
} from "clanker-cleanroom";

/**
 * Copilot CLI `--output-format json` emits JSONL with a dotted-type envelope:
 * `{ "type": "assistant.message", "data": { ... } }`. Older builds used flat
 * types (`message`, `tool_use`, `tool_result`, `usage`); both are handled.
 */
export function adaptCopilotEvents(rawEvents: readonly unknown[]): TrajectoryEvent[] {
  const events: TrajectoryEvent[] = [];

  for (const raw of rawEvents) {
    const record = asRecord(raw);
    if (record === undefined) {
      events.push({ kind: "other", type: "unknown", raw });
      continue;
    }

    const type = readString(record.type) ?? "unknown";
    const data = asRecord(record.data) ?? record;

    switch (type) {
      case "session.start":
        events.push({
          kind: "system",
          sessionId: readString(data.sessionId),
          model: readString(data.selectedModel),
          raw,
        });
        break;
      case "assistant.message": {
        events.push({ kind: "assistant", text: readString(data.content) ?? "", raw });
        break;
      }
      case "tool.execution_start":
        events.push({
          kind: "tool",
          phase: "started",
          callId: readString(data.toolCallId) ?? "",
          name: readString(data.toolName) ?? "unknown",
          args: data.arguments ?? data.input ?? null,
          result: null,
          raw,
        });
        break;
      case "tool.execution_complete":
        events.push({
          kind: "tool",
          phase: "completed",
          callId: readString(data.toolCallId) ?? "",
          name: readString(data.toolName) ?? "unknown",
          args: null,
          result: data.success === undefined ? null : { success: data.success },
          raw,
        });
        break;
      case "result":
        events.push(adaptCopilotResult(data, raw));
        break;
      case "session.error":
        events.push({
          kind: "result",
          text: readString(data.message) ?? readString(data.error) ?? "",
          isError: true,
          durationMs: null,
          costUsd: null,
          raw,
        });
        break;
      default:
        events.push({ kind: "other", type, raw });
    }
  }

  return events;
}

function adaptCopilotResult(
  data: Record<string, unknown>,
  raw: unknown,
): Extract<TrajectoryEvent, { kind: "result" }> {
  const usage = asRecord(data.usage);
  return {
    kind: "result",
    text: readString(data.content) ?? readString(data.result) ?? "",
    isError: readTokenCount(data.exitCode) !== 0 && data.exitCode !== undefined,
    durationMs: readTokenCount(usage?.totalApiDurationMs),
    costUsd: null,
    raw,
  };
}
