import type { Agent, AgentOptions, AgentResult } from "./agents/types.js";

export type { AgentResult, Agent, AgentOptions };
export type { AgentName } from "./agents/registry.js";
export type { ConfigureAgentOptions } from "./given/agent.js";

export type AgentContext = {
  workspace: string;
  prompt: string;
  agentResult: AgentResult;
  agent: Agent;
  image: string;
  model?: string;
  timeoutMs?: number;
};
