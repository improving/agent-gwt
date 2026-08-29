import type { AgentName } from "./registry.js";
import { resolveAgent } from "./registry.js";

export async function buildAgentImage(name: AgentName): Promise<void> {
  await resolveAgent(name).buildImage();
}
