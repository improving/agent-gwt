import { CURSOR_IMAGE } from "./cursor/constants.js";
import { CLAUDE_IMAGE } from "./claude/constants.js";
import { BASE_IMAGE } from "./base/constants.js";

export type StockAgentName = "cursor" | "claude";

export const STOCK_AGENT_IMAGES = {
  cursor: CURSOR_IMAGE,
  claude: CLAUDE_IMAGE,
} as const satisfies Record<StockAgentName, string>;

export { BASE_IMAGE };

/** Map a Docker image tag to a stock agent name, if it is a stock agent image. */
export function stockAgentNameForImage(image: string): StockAgentName | undefined {
  if (image === CURSOR_IMAGE) {
    return "cursor";
  }
  if (image === CLAUDE_IMAGE) {
    return "claude";
  }
  return undefined;
}

export function isStockAgentName(name: string): name is StockAgentName {
  return name === "cursor" || name === "claude";
}
