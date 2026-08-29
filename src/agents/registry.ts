import { cursorAgent } from "./cursor/agent.js";
import type { Agent } from "./types.js";

export const agentRegistry = {
  cursor: cursorAgent,
} as const;

export type AgentName = keyof typeof agentRegistry;

export function resolveAgent(name: AgentName): Agent {
  return agentRegistry[name];
}
