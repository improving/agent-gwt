import { describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import type { Agent, AgentContext } from "../types.js";
import { executing_the_agent } from "./executing_the_agent.js";

type Context = AgentContext & {
  runMock: ReturnType<typeof vi.fn>;
};

describe("executing_the_agent", () => {
  test("stores the agent result on the context", {
    given: {
      workspace_prompt_and_agent,
    },
    when: {
      executing_the_agent,
    },
    then: {
      agent_result_is_set,
      agent_was_called_with_workspace_and_prompt,
    },
  });

  test("forwards model from the context", {
    given: {
      workspace_prompt_model_and_agent,
    },
    when: {
      executing_the_agent,
    },
    then: {
      agent_was_called_with_model,
    },
  });

  test("requires a workspace", {
    given: {
      prompt_and_agent_only,
    },
    when: {
      executing_the_agent,
    },
    then: {
      expect_error: error_requires_workspace,
    },
  });

  test("requires a prompt", {
    given: {
      workspace_and_agent_only,
    },
    when: {
      executing_the_agent,
    },
    then: {
      expect_error: error_requires_prompt,
    },
  });

  test("requires an agent", {
    given: {
      workspace_and_prompt_without_agent,
    },
    when: {
      executing_the_agent,
    },
    then: {
      expect_error: error_requires_agent,
    },
  });
});

function stubAgent(this: Context): void {
  this.runMock = vi.fn(async () => ({ type: "result", result: "done" }));
  this.agent = {
    image: "agent-gwt/test:local",
    ensureImage: async () => undefined,
    buildImage: async () => undefined,
    run: this.runMock as Agent["run"],
  };
}

function workspace_prompt_and_agent(this: Context) {
  stubAgent.call(this);
  this.workspace = "/tmp/.agents-gwt/ws-test";
  this.prompt = "Create a README";
  this.image = this.agent.image;
}

function workspace_prompt_model_and_agent(this: Context) {
  stubAgent.call(this);
  this.workspace = "/tmp/.agents-gwt/ws-test";
  this.prompt = "Create a README";
  this.model = "composer-2";
  this.image = this.agent.image;
}

function prompt_and_agent_only(this: Context) {
  stubAgent.call(this);
  this.prompt = "Create a README";
  this.image = this.agent.image;
  this.workspace = "";
}

function workspace_and_agent_only(this: Context) {
  stubAgent.call(this);
  this.workspace = "/tmp/.agents-gwt/ws-test";
  this.image = this.agent.image;
  this.prompt = "";
}

function workspace_and_prompt_without_agent(this: Context) {
  this.workspace = "/tmp/.agents-gwt/ws-test";
  this.prompt = "Create a README";
  this.agent = undefined as unknown as Agent;
}

function agent_result_is_set(this: Context) {
  expect(this.agentResult).toEqual({ type: "result", result: "done" });
}

function agent_was_called_with_workspace_and_prompt(this: Context) {
  expect(this.runMock).toHaveBeenCalledWith({
    workspace: "/tmp/.agents-gwt/ws-test",
    prompt: "Create a README",
    image: "agent-gwt/test:local",
  });
}

function agent_was_called_with_model(this: Context) {
  expect(this.runMock).toHaveBeenCalledWith({
    workspace: "/tmp/.agents-gwt/ws-test",
    prompt: "Create a README",
    image: "agent-gwt/test:local",
    model: "composer-2",
  });
}

function error_requires_workspace(this: Context, error: Error) {
  expect(error.message).toContain("this.workspace");
}

function error_requires_prompt(this: Context, error: Error) {
  expect(error.message).toContain("this.prompt");
}

function error_requires_agent(this: Context, error: Error) {
  expect(error.message).toContain("this.agent");
}
