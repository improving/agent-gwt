import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { the_prompt } from "./the_prompt.js";
import type { AgentContext } from "../types.js";

type Context = AgentContext;

describe("the_prompt", () => {
  test("stores the prompt on the agent context", {
    when: {
      the_prompt: the_prompt("Create a README"),
    },
    then: {
      prompt_is_set,
    },
  });
});

function prompt_is_set(this: Context) {
  expect(this.prompt).toBe("Create a README");
}
