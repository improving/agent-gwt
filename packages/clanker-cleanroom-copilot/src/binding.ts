import {
  asRecord,
  parseAgentJsonOutput,
  readString,
  readTokenCount,
  type AgentBinding,
  type AgentRunResult,
  type DockerVolumeMount,
} from "clanker-cleanroom";

import { CONTAINER_COPILOT_HOME, COPILOT_IMAGE } from "./constants.js";
import { credentialsEnv, resolveCopilotCredentials } from "./credentials.js";
import { adaptCopilotEvents } from "./trajectory.js";

export const copilotBinding: AgentBinding = {
  image: COPILOT_IMAGE,
  displayName: "Copilot",
  trajectoryKind: "copilot",
  adaptEvents: adaptCopilotEvents,
  command: ({ prompt, model }) => {
    const copilotArgs = [
      "copilot",
      "--output-format",
      "json",
      "--allow-all-tools",
      "--allow-all-paths",
      "--no-ask-user",
    ];
    if (model !== undefined && model !== "") {
      copilotArgs.push("--model", model);
    }
    copilotArgs.push("-p", prompt);
    return copilotArgs;
  },
  prepare: async () => {
    const credentials = await resolveCopilotCredentials();
    const volumes: DockerVolumeMount[] = [];
    if (credentials.kind === "config-dir") {
      volumes.push({
        host: credentials.dir,
        container: CONTAINER_COPILOT_HOME,
        mode: "ro",
      });
    }
    return {
      volumes,
      env: credentialsEnv(credentials),
    };
  },
  parseResult: parseCopilotResult,
  describeFailure: describeCopilotFailure,
};

function parseCopilotResult(trajectory: string): AgentRunResult {
  const parsed = parseAgentJsonOutput(trajectory);
  const record = asRecord(parsed);
  if (record === undefined) {
    throw new Error("Copilot agent produced no parsable result event");
  }

  const data = asRecord(record.data) ?? record;
  const result = copilotResultFrom(data);
  if (result.exitCode !== 0 && result.exitCode !== null) {
    throw new Error(`Copilot agent reported an error: ${result.text || "unknown error"}`);
  }

  return {
    durationMs: result.durationMs,
    costUsd: null,
    usage: {
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    },
  };
}

function describeCopilotFailure(trajectory: string): string | undefined {
  try {
    const record = asRecord(parseAgentJsonOutput(trajectory));
    if (record === undefined) {
      return undefined;
    }
    const data = asRecord(record.data) ?? record;
    const result = copilotResultFrom(data);
    return result.exitCode !== 0 && result.text !== "" ? result.text : undefined;
  } catch {
    return undefined;
  }
}

function copilotResultFrom(data: Record<string, unknown>): {
  exitCode: number | null;
  text: string;
  durationMs: number | null;
} {
  const usage = asRecord(data.usage);
  return {
    exitCode: readTokenCount(data.exitCode),
    text: readString(data.content) ?? readString(data.result) ?? "",
    durationMs: readTokenCount(usage?.totalApiDurationMs),
  };
}
