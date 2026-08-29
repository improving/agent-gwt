import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect } from "vitest";
import test, { withAspect } from "vitest-gwt";
import {
  type AgentContext,
  type ClaudeAgentResult,
  a_workspace,
  agent,
  cleanup_workspace,
  executing_the_agent,
  the_prompt,
} from "../src/index.js";

describe("claude agent (e2e)", () => {
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
      result_is_a_successful_claude_run,
    },
  });
});

type Context = AgentContext;

async function readme_exists(this: Context) {
  await access(join(this.workspace, "README.md"));
}

async function readme_contains_HELLO_WORLD(this: Context) {
  const contents = await readFile(join(this.workspace, "README.md"), "utf-8");

  expect(contents.toLowerCase()).toContain("hello world");
}

function result_is_a_successful_claude_run(this: Context) {
  const result = this.agentResult as ClaudeAgentResult;

  expect(result.type).toBe("result");
  expect(result.is_error).toBe(false);
  expect(result.num_turns).toBeGreaterThan(0);
  console.log(`claude: ${result.num_turns} turns, $${result.total_cost_usd.toFixed(4)}, session ${result.session_id}`);
}
