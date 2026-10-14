import { Agent, type HarnessResult } from "@agentfield/sdk";

import { clanker, type ClankerDeps } from "./clanker.js";
import type { ClankerOptions } from "./options.js";

const INSTALLED = Symbol.for("@clanker-cleanroom/plugin-agentfield.installed");

type AgentConstructor = typeof Agent;

type AgentPrototype = {
  clanker?: (
    prompt: string,
    options: ClankerOptions,
    deps?: ClankerDeps,
  ) => Promise<HarnessResult>;
  [INSTALLED]?: boolean;
};

/**
 * Monkeypatch {@link Agent}.prototype with `clanker(prompt, options, deps?)`.
 * Idempotent — safe to call more than once.
 */
export function installClanker(AgentClass: AgentConstructor = Agent): void {
  const proto = AgentClass.prototype as AgentPrototype;
  if (proto[INSTALLED]) {
    return;
  }

  proto.clanker = function clankerMethod(
    this: Agent,
    prompt: string,
    options: ClankerOptions,
    deps?: ClankerDeps,
  ): Promise<HarnessResult> {
    return clanker(prompt, options, deps);
  };
  proto[INSTALLED] = true;
}

declare module "@agentfield/sdk" {
  interface Agent {
    clanker(
      prompt: string,
      options: ClankerOptions,
      deps?: ClankerDeps,
    ): Promise<HarnessResult>;
  }
}
