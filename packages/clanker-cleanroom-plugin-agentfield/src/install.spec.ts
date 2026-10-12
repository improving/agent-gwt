import { Agent } from "@agentfield/sdk";
import { describe, expect } from "vitest";
import test from "vitest-gwt";

import { installClanker } from "./install.js";

type Context = {
  first?: typeof Agent.prototype.clanker;
  second?: typeof Agent.prototype.clanker;
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
