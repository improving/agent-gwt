import { claudeBinding } from "./claude/binding.js";
import { cursorBinding } from "./cursor/binding.js";
import type { StockAgentName } from "./stock.js";
import type { AgentBinding } from "./types.js";

export const bindingRegistry: Record<StockAgentName, AgentBinding> = {
  cursor: cursorBinding,
  claude: claudeBinding,
};

export function resolveBinding(name: StockAgentName): AgentBinding {
  return bindingRegistry[name];
}
