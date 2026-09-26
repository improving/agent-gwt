import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { devinBinding } from "./binding.js";

type Context = {
  result?: ReturnType<typeof devinBinding.parseResult>;
  error?: Error;
};

const ATIF_FIXTURE = JSON.stringify({
  schema_version: "ATIF-v1.8",
  session_id: "sess-devin",
  agent: { name: "devin-cli", version: "1.0.0", model_name: "devin-model" },
  steps: [
    { step_id: 1, source: "user", message: "Fix the tests" },
    {
      step_id: 2,
      source: "agent",
      message: "Running the suite",
      tool_calls: [
        { tool_call_id: "t1", function_name: "shell", arguments: { command: "pnpm test" } },
      ],
      observation: {
        results: [{ tool_call_id: "t1", content: "all passing" }],
      },
      metrics: { prompt_tokens: 100, completion_tokens: 10, cached_tokens: 20, cost_usd: 0.01 },
    },
  ],
  final_metrics: {
    total_prompt_tokens: 100,
    total_completion_tokens: 10,
    total_cached_tokens: 20,
    total_cost_usd: 0.05,
  },
});

describe("devinBinding.parseResult", () => {
  test("maps ATIF final_metrics into normalized usage", {
    when: {
      parsing_atif_export,
    },
    then: {
      metrics_mapped_from_final_metrics,
    },
  });

  test("sums per-step metrics when final_metrics is absent", {
    when: {
      parsing_atif_without_final_metrics,
    },
    then: {
      usage_summed_from_steps,
    },
  });

  test("throws when the trajectory is not an ATIF document", {
    when: {
      parsing_non_atif_output_catching,
    },
    then: {
      error_mentions_atif,
    },
  });
});

function parsing_atif_export(this: Context) {
  this.result = devinBinding.parseResult(ATIF_FIXTURE);
}

function parsing_atif_without_final_metrics(this: Context) {
  const withoutSummary = JSON.parse(ATIF_FIXTURE) as Record<string, unknown>;
  delete withoutSummary.final_metrics;
  this.result = devinBinding.parseResult(JSON.stringify(withoutSummary));
}

function parsing_non_atif_output_catching(this: Context) {
  try {
    devinBinding.parseResult(JSON.stringify({ type: "result", result: "not atif" }));
  } catch (error) {
    this.error = error as Error;
  }
}

function metrics_mapped_from_final_metrics(this: Context) {
  expect(this.result).toEqual({
    durationMs: null,
    costUsd: 0.05,
    usage: {
      inputTokens: 100,
      outputTokens: 10,
      cacheReadTokens: 20,
      cacheWriteTokens: null,
    },
  });
}

function usage_summed_from_steps(this: Context) {
  expect(this.result?.usage).toEqual({
    inputTokens: 100,
    outputTokens: 10,
    cacheReadTokens: 20,
    cacheWriteTokens: null,
  });
  expect(this.result?.costUsd).toBeNull();
}

function error_mentions_atif(this: Context) {
  expect(this.error?.message).toContain("ATIF");
}
