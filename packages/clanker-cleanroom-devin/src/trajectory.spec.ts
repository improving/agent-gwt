import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { parseTrajectory, type Trajectory } from "clanker-cleanroom";

import { adaptDevinEvents } from "./trajectory.js";

type Context = {
  trajectory?: Trajectory;
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
      message: [
        { type: "text", text: "Using the shell" },
      ],
      tool_calls: [
        { tool_call_id: "t1", function_name: "shell", arguments: { command: "pnpm test" } },
      ],
      observation: {
        results: [{ tool_call_id: "t1", content: "tests pass" }],
      },
    },
    { step_id: 3, source: "agent", message: "All done." },
  ],
  final_metrics: { total_cost_usd: 0.05 },
});

describe("adaptDevinEvents", () => {
  test("normalizes an ATIF document into system, user, assistant, tool, and result events", {
    when: {
      parsing_atif_fixture,
    },
    then: {
      system_event_from_agent_metadata,
      user_step_mapped,
      assistant_step_mapped,
      tool_calls_expanded_from_steps_and_observations,
      result_from_last_agent_message,
    },
  });
});

function parsing_atif_fixture(this: Context) {
  this.trajectory = parseTrajectory(ATIF_FIXTURE, "devin", adaptDevinEvents);
}

function system_event_from_agent_metadata(this: Context) {
  const system = this.trajectory?.events.find((event) => event.kind === "system");
  expect(system).toMatchObject({ sessionId: "sess-devin", model: "devin-model" });
}
function user_step_mapped(this: Context) {
  expect(this.trajectory?.events).toContainEqual(
    expect.objectContaining({ kind: "user", text: "Fix the tests" }),
  );
}

function assistant_step_mapped(this: Context) {
  expect(this.trajectory?.events).toContainEqual(
    expect.objectContaining({ kind: "assistant", text: "Using the shell" }),
  );
}

function tool_calls_expanded_from_steps_and_observations(this: Context) {
  expect(this.trajectory?.toolCalls()).toEqual([
    {
      callId: "t1",
      name: "shell",
      args: { command: "pnpm test" },
      result: "tests pass",
    },
  ]);
}

function result_from_last_agent_message(this: Context) {
  const result = this.trajectory?.result();
  expect(result).toMatchObject({
    kind: "result",
    text: "All done.",
    isError: false,
    costUsd: 0.05,
  });
}

