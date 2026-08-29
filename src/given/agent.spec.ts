import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import { agentRegistry } from "../agents/registry.js";
import { CURSOR_IMAGE } from "../agents/cursor/constants.js";
import { agent } from "./agent.js";
import type { AgentContext } from "../types.js";

type Context = AgentContext & {
  ensureCalls: number;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("agent", () => {
  test("sets agent, model, and image from the resolved agent", {
    given: {
      stub_ensure_image,
    },
    when: {
      applying_agent: agent({ name: "cursor", model: "auto" }),
    },
    then: {
      agent_is_cursor,
      model_is_set,
      image_is_set_from_agent,
      ensure_was_called,
    },
  });
});

function stub_ensure_image(this: Context) {
  this.ensureCalls = 0;
  vi.spyOn(agentRegistry.cursor, "ensureImage").mockImplementation(async () => {
    this.ensureCalls += 1;
  });
}

function agent_is_cursor(this: Context) {
  expect(this.agent).toBe(agentRegistry.cursor);
}

function model_is_set(this: Context) {
  expect(this.model).toBe("auto");
}

function image_is_set_from_agent(this: Context) {
  expect(this.image).toBe(CURSOR_IMAGE);
}

function ensure_was_called(this: Context) {
  expect(this.ensureCalls).toBe(1);
  expect(agentRegistry.cursor.ensureImage).toHaveBeenCalledWith();
}
