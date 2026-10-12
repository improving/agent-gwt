import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CostTracker, ExecutionContext, usageSummaryOrNull } from "@agentfield/sdk";
import {
  AgentAbortError,
  emptyTokenUsage,
  type AgentRunResult,
  type RunAgentOptions,
  type Trajectory,
} from "clanker-cleanroom";
import { describe, expect } from "vitest";
import test from "vitest-gwt";
import { z } from "zod";

import { clanker, type CleanroomAgentLike } from "./clanker.js";
import { OUTPUT_FILENAME } from "./schema.js";

type Context = {
  workspace: string;
  result?: Awaited<ReturnType<typeof clanker>>;
  tracker?: CostTracker;
  mock?: MockAgent;
};

class MockAgent implements CleanroomAgentLike {
  runImpl: (options: RunAgentOptions) => Promise<AgentRunResult> = async () => ({
    durationMs: 100,
    costUsd: 0.25,
    usage: {
      inputTokens: 5,
      outputTokens: 7,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    },
  });

  trajectoryImpl: () => Promise<Trajectory> = async () =>
    ({
      provider: "cursor",
      events: [
        { kind: "assistant", text: "done", raw: {} },
        {
          kind: "result",
          text: "done",
          isError: false,
          durationMs: 100,
          costUsd: 0.25,
          raw: {},
        },
      ],
      sessionId: () => "sess-1",
      result: () => ({
        kind: "result" as const,
        text: "done",
        isError: false,
        durationMs: 100,
        costUsd: 0.25,
        raw: {},
      }),
      assistantMessages: () => ["done"],
      toolCalls: () => [],
    }) satisfies Trajectory;

  sessionIdImpl: () => string | null = () => "sess-1";

  async run(options: RunAgentOptions): Promise<AgentRunResult> {
    return this.runImpl(options);
  }

  async trajectory(): Promise<Trajectory> {
    return this.trajectoryImpl();
  }

  sessionId(): string | null {
    return this.sessionIdImpl();
  }
}

describe("clanker", () => {
  test("maps metrics and records usage under an execution context", {
    given: {
      temp_workspace,
      mock_agent,
      active_execution,
    },
    when: {
      running_clanker,
    },
    then: {
      result_mapped,
      usage_recorded,
    },
  });

  test("returns result without throwing when no execution context", {
    given: {
      temp_workspace,
      mock_agent,
    },
    when: {
      running_clanker,
    },
    then: {
      result_mapped,
    },
  });

  test("sets isError on abort and preserves abort metrics", {
    given: {
      temp_workspace,
      mock_agent_that_aborts,
    },
    when: {
      running_clanker,
    },
    then: {
      result_is_error_with_abort_cost,
    },
  });

  test("validates schema output from the workspace", {
    given: {
      temp_workspace,
      mock_agent_writing_schema_output,
    },
    when: {
      running_clanker_with_schema,
    },
    then: {
      parsed_matches_schema,
    },
  });

  test("fails when schema output is missing", {
    given: {
      temp_workspace,
      mock_agent,
    },
    when: {
      running_clanker_with_schema,
    },
    then: {
      result_is_schema_error,
    },
  });
});

function temp_workspace(this: Context) {
  this.workspace = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-agentfield-"));
}

function mock_agent(this: Context) {
  this.mock = new MockAgent();
}

function mock_agent_that_aborts(this: Context) {
  this.mock = new MockAgent();
  this.mock.runImpl = async () => {
    throw new AgentAbortError({
      durationMs: 50,
      costUsd: 0.11,
      usage: {
        inputTokens: 1,
        outputTokens: 2,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      },
    });
  };
}

function mock_agent_writing_schema_output(this: Context) {
  this.mock = new MockAgent();
  this.mock.runImpl = async (options) => {
    fs.writeFileSync(
      path.join(options.workspace, OUTPUT_FILENAME),
      JSON.stringify({ summary: "ok", ok: true }),
      "utf8",
    );
    return {
      durationMs: 10,
      costUsd: null,
      usage: emptyTokenUsage(),
    };
  };
}

function active_execution(this: Context) {
  this.tracker = new CostTracker();
}

async function running_clanker(this: Context) {
  const run = () =>
    clanker(
      "do the thing",
      { agent: "cursor", workspace: this.workspace, model: "auto" },
      { createAgent: () => this.mock! },
    );

  if (this.tracker) {
    const fakeCtx = {
      costTracker: this.tracker,
      metadata: { reasonerId: "fix", executionId: "exec-1" },
    } as ExecutionContext;
    this.result = await ExecutionContext.run(fakeCtx, run);
  } else {
    this.result = await run();
  }
}

async function running_clanker_with_schema(this: Context) {
  this.result = await clanker(
    "do the thing",
    {
      agent: "cursor",
      workspace: this.workspace,
      schema: z.object({ summary: z.string(), ok: z.boolean() }),
    },
    { createAgent: () => this.mock! },
  );
}

function result_mapped(this: Context) {
  expect(this.result?.isError).toBe(false);
  expect(this.result?.text).toBe("done");
  expect(this.result?.costUsd).toBe(0.25);
  expect(this.result?.inputTokens).toBe(5);
  expect(this.result?.outputTokens).toBe(7);
  expect(this.result?.sessionId).toBe("sess-1");
  expect(this.result?.numTurns).toBe(1);
}

function usage_recorded(this: Context) {
  const summary = usageSummaryOrNull(this.tracker);
  expect(summary?.entries).toHaveLength(1);
  expect(summary?.entries[0]).toMatchObject({
    source: "harness",
    harness: "clanker_cursor",
    cost_usd: 0.25,
  });
}

function result_is_error_with_abort_cost(this: Context) {
  expect(this.result?.isError).toBe(true);
  expect(this.result?.costUsd).toBe(0.11);
  expect(this.result?.errorMessage).toContain("aborted");
}

function parsed_matches_schema(this: Context) {
  expect(this.result?.isError).toBe(false);
  expect(this.result?.parsed).toEqual({ summary: "ok", ok: true });
}

function result_is_schema_error(this: Context) {
  expect(this.result?.isError).toBe(true);
  expect(this.result?.failureType).toBe("schema");
}
