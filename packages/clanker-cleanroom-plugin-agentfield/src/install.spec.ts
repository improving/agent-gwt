import { Agent } from "@agentfield/sdk";
import { describe, expect, vi } from "vitest";
import test from "vitest-gwt";

import * as clankerModule from "./clanker.js";
import { installClanker } from "./install.js";

type Context = {
  first?: typeof Agent.prototype.clanker;
  second?: typeof Agent.prototype.clanker;
  createAgent?: ReturnType<typeof vi.fn>;
  clankerSpy?: ReturnType<typeof vi.spyOn>;
};

describe("installClanker", () => {
  test("adds clanker to the prototype and is idempotent", {
    when: {
      installing_twice,
    },
    then: {
      method_exists_and_is_stable,
    },
  });

  test("forwards optional deps to free clanker", {
    given: {
      installed_clanker,
      spy_on_free_clanker,
    },
    when: {
      calling_agent_clanker_with_deps,
    },
    then: {
      free_clanker_received_deps,
    },
  });
});

function installing_twice(this: Context) {
  installClanker();
  this.first = Agent.prototype.clanker;
  installClanker();
  this.second = Agent.prototype.clanker;
}

function method_exists_and_is_stable(this: Context) {
  expect(typeof this.first).toBe("function");
  expect(this.second).toBe(this.first);
}

function installed_clanker() {
  installClanker();
}

function spy_on_free_clanker(this: Context) {
  this.clankerSpy = vi.spyOn(clankerModule, "clanker").mockResolvedValue({
    text: "",
    isError: false,
  } as Awaited<ReturnType<typeof clankerModule.clanker>>);
}

async function calling_agent_clanker_with_deps(this: Context) {
  this.createAgent = vi.fn();
  await Agent.prototype.clanker!(
    "prompt",
    { agent: "cursor", workspace: "/tmp/ws" },
    { createAgent: this.createAgent as never },
  );
}

function free_clanker_received_deps(this: Context) {
  expect(this.clankerSpy).toHaveBeenCalledWith(
    "prompt",
    { agent: "cursor", workspace: "/tmp/ws" },
    { createAgent: this.createAgent },
  );
  this.clankerSpy?.mockRestore();
}
