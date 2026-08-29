import { afterEach, describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import { buildAgentImage } from "./build-agent-image.js";
import { agentRegistry } from "./registry.js";

type Context = {
  buildCalls: number;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildAgentImage", () => {
  test("delegates to the resolved agent's buildImage", {
    given: {
      stub_cursor_build_image,
    },
    when: {
      building_cursor_image,
    },
    then: {
      build_was_called,
    },
  });
});

function stub_cursor_build_image(this: Context) {
  this.buildCalls = 0;
  vi.spyOn(agentRegistry.cursor, "buildImage").mockImplementation(async () => {
    this.buildCalls += 1;
  });
}

async function building_cursor_image() {
  await buildAgentImage("cursor");
}

function build_was_called(this: Context) {
  expect(this.buildCalls).toBe(1);
  expect(agentRegistry.cursor.buildImage).toHaveBeenCalledWith();
}
