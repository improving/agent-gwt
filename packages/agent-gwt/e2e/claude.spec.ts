import { describe, expect } from "vitest";
import test, { withAspect } from "vitest-gwt";
import {
  type AgentContext,
  a_workspace,
  agent,
  cleanup_workspace,
  executing_the_agent,
  the_prompt,
} from "../src/index.js";
import { hasClaudeCredential } from "./credentials.js";
import { readme_contains_HELLO_WORLD, readme_exists } from "./steps.js";

describe.skipIf(!hasClaudeCredential())("claude agent (e2e)", () => {
  withAspect(agent({ name: "claude", model: "sonnet" }));
  withAspect(a_workspace, cleanup_workspace);

  test("writes the readme", {
    given: {
      the_prompt: the_prompt("Write 'Hello World' to README.md"),
    },
    when: {
      executing_the_agent,
    },
    then: {
      readme_exists,
      readme_contains_HELLO_WORLD,
      result_has_metrics,
    },
  });
});

function result_has_metrics(this: AgentContext) {
  expect(this.agentResult.durationMs).not.toBeNull();
  expect(this.agentResult.costUsd).not.toBeNull();
  console.log(
    `claude: ${this.agentResult.durationMs}ms, $${(this.agentResult.costUsd ?? 0).toFixed(4)}`,
  );
}
