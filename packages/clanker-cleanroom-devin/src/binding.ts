import {
  CONTAINER_TRAJECTORY_PATH,
  asRecord,
  readTokenCount,
  type AgentBinding,
  type AgentRunResult,
} from "clanker-cleanroom";

import { DEVIN_CONTAINER_CREDENTIALS_PATH, DEVIN_IMAGE } from "./constants.js";
import { credentialsEnv, resolveDevinCredentials } from "./credentials.js";
import { adaptDevinEvents } from "./trajectory.js";

export const devinBinding: AgentBinding = {
  image: DEVIN_IMAGE,
  displayName: "Devin",
  trajectoryKind: "devin",
  adaptEvents: adaptDevinEvents,
  command: ({ prompt, model }) => {
    // Devin writes its ATIF export to a file (--export) rather than stdout, so
    // point --export at the container trajectory path and discard stdout — the
    // runner's own stdout redirect would otherwise clobber the export file.
    const devinArgs = [
      "sh",
      "-c",
      'exec "$@" >/dev/null',
      "sh",
      "devin",
      "-p",
      "--permission-mode",
      "bypass",
      "--respect-workspace-trust",
      "false",
      "--export",
      CONTAINER_TRAJECTORY_PATH,
    ];
    if (model !== undefined && model !== "") {
      devinArgs.push("--model", model);
    }
    devinArgs.push("--", prompt);
    return devinArgs;
  },
  prepare: async () => {
    const credentials = await resolveDevinCredentials();
    const volumes = [];
    if (credentials.kind === "credentials-file") {
      volumes.push({
        host: credentials.file,
        container: DEVIN_CONTAINER_CREDENTIALS_PATH,
        mode: "ro",
      });
    }
    return {
      volumes,
      env: credentialsEnv(credentials),
    };
  },
  parseResult: parseDevinResult,
  describeFailure: describeDevinFailure,
};

/**
 * Parse the ATIF export document (a single JSON object, not NDJSON) into
 * normalized metrics from `final_metrics`, falling back to summing per-step
 * metrics when the summary is absent.
 */
function parseDevinResult(trajectory: string): AgentRunResult {
  const atif = parseAtif(trajectory);
  const finalMetrics = asRecord(atif.final_metrics);

  const usage = finalMetrics !== undefined
    ? {
        inputTokens: readTokenCount(finalMetrics.total_prompt_tokens),
        outputTokens: readTokenCount(finalMetrics.total_completion_tokens),
        cacheReadTokens: readTokenCount(finalMetrics.total_cached_tokens),
        cacheWriteTokens: null,
      }
    : sumStepUsage(atif);

  return {
    durationMs: durationFromSteps(atif),
    costUsd: readTokenCount(finalMetrics?.total_cost_usd),
    usage,
  };
}

function describeDevinFailure(trajectory: string): string | undefined {
  try {
    const atif = parseAtif(trajectory);
    if (!Array.isArray(atif.steps) || atif.steps.length === 0) {
      return "ATIF trajectory contains no steps";
    }
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function parseAtif(trajectory: string): Record<string, unknown> {
  const trimmed = trajectory.trim();
  if (trimmed === "") {
    throw new Error("Devin produced empty trajectory; expected ATIF JSON export");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Devin trajectory was not valid ATIF JSON: ${detail}\nTrajectory:\n${trajectory}`);
  }

  const record = asRecord(parsed);
  if (record === undefined || !Array.isArray(record.steps)) {
    throw new Error("Devin trajectory is not an ATIF document (missing steps array)");
  }
  return record;
}

function sumStepUsage(atif: Record<string, unknown>): AgentRunResult["usage"] {
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let cacheReadTokens: number | null = null;

  for (const step of stepsOf(atif)) {
    const metrics = asRecord(step.metrics);
    inputTokens = addCounts(inputTokens, readTokenCount(metrics?.prompt_tokens));
    outputTokens = addCounts(outputTokens, readTokenCount(metrics?.completion_tokens));
    cacheReadTokens = addCounts(cacheReadTokens, readTokenCount(metrics?.cached_tokens));
  }

  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens: null };
}

function addCounts(a: number | null, b: number | null): number | null {
  if (a === null) {
    return b;
  }
  if (b === null) {
    return a;
  }
  return a + b;
}

function durationFromSteps(atif: Record<string, unknown>): number | null {
  const steps = stepsOf(atif);
  const first = timestampMs(steps[0]?.timestamp);
  const last = timestampMs(steps[steps.length - 1]?.timestamp);
  if (first === null || last === null || last < first) {
    return null;
  }
  return last - first;
}

function timestampMs(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function stepsOf(record: Record<string, unknown>): Record<string, unknown>[] {
  const steps = record.steps;
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.map((step) => asRecord(step)).filter((step) => step !== undefined);
}
