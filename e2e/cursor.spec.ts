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
import { hasCursorCredential } from "./credentials.js";
import { readme_contains_HELLO_WORLD, readme_exists } from "./steps.js";

describe.skipIf(!hasCursorCredential())("cursor agent (e2e)", () => {
  withAspect(agent({ name: "cursor", model: "auto" }));
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
      result_is_parsed_json,
    },
  });
});

function result_is_parsed_json(this: AgentContext) {
  expect(this.agentResult).toBeTypeOf("object");
}
