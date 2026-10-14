import {
  CostTracker,
  createHarnessResult,
  ExecutionContext,
  usageSummaryOrNull,
} from "@agentfield/sdk";
import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { harnessNameForAgent, recordClankerUsage } from "./record-usage.js";

type Context = {
  tracker: CostTracker;
  harnessName?: string;
};

describe("harnessNameForAgent", () => {
  test("prefixes and sanitizes agent names", {
    when: {
      naming_cursor_node,
    },
    then: {
      name_is_clanker_cursor_node,
    },
  });
});

describe("recordClankerUsage", () => {
  test("records harness entry when execution context is active", {
    given: {
      active_execution_with_tracker,
    },
    when: {
      recording_usage_with_cost_and_tokens,
    },
    then: {
      tracker_has_harness_entry,
    },
  });

  test("skips empty metrics", {
    given: {
      active_execution_with_tracker,
    },
    when: {
      recording_empty_usage,
    },
    then: {
      tracker_is_empty,
    },
  });

  test("no-ops without execution context", {
    when: {
      recording_usage_without_context,
    },
    then: {
      does_not_throw,
    },
  });
});

function naming_cursor_node(this: Context) {
  this.harnessName = harnessNameForAgent("cursor:node");
}

function name_is_clanker_cursor_node(this: Context) {
  expect(this.harnessName).toBe("clanker_cursor_node");
}

function active_execution_with_tracker(this: Context) {
  this.tracker = new CostTracker();
}

function recording_usage_with_cost_and_tokens(this: Context) {
  const fakeCtx = {
    costTracker: this.tracker,
    metadata: { reasonerId: "fix", executionId: "exec-1" },
  } as ExecutionContext;

  ExecutionContext.run(fakeCtx, () => {
    recordClankerUsage(
      createHarnessResult({
        costUsd: 0.42,
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
        numTurns: 2,
        durationMs: 100,
        sessionId: "sess",
      }),
      { agent: "cursor", model: "auto" },
    );
  });
}

function tracker_has_harness_entry(this: Context) {
  const summary = usageSummaryOrNull(this.tracker);
  expect(summary).not.toBeNull();
  expect(summary!.entries).toHaveLength(1);
  expect(summary!.entries[0]).toMatchObject({
    source: "harness",
    harness: "clanker_cursor",
    model: "auto",
    reasoner: "fix",
    cost_usd: 0.42,
    input_tokens: 10,
    output_tokens: 20,
    total_tokens: 30,
  });
}

function recording_empty_usage(this: Context) {
  const fakeCtx = {
    costTracker: this.tracker,
    metadata: { reasonerId: "fix", executionId: "exec-1" },
  } as ExecutionContext;

  ExecutionContext.run(fakeCtx, () => {
    recordClankerUsage(
      createHarnessResult({
        numTurns: 0,
        durationMs: 0,
        sessionId: "",
      }),
      { agent: "cursor" },
    );
  });
}

function tracker_is_empty(this: Context) {
  expect(this.tracker.callCount).toBe(0);
  expect(usageSummaryOrNull(this.tracker)).toBeNull();
}

function recording_usage_without_context(this: Context) {
  recordClankerUsage(
    createHarnessResult({
      costUsd: 1,
      numTurns: 1,
      durationMs: 1,
      sessionId: "x",
      inputTokens: 1,
    }),
    { agent: "claude" },
  );
}

function does_not_throw(this: Context) {
  expect(true).toBe(true);
}
