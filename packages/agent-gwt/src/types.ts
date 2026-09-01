import type { Agent, AgentName, AgentOptions, AgentResult } from "clanker-cleanroom";

export type { AgentResult, Agent, AgentOptions, AgentName };
export type { ConfigureAgentOptions } from "./given/agent.js";

export type AgentContext = {
  workspace: string;
  prompt: string;
  agentResult: AgentResult;
  agent: Agent;
  image: string;
  model?: string;
};
