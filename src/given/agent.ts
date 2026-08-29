import type { AgentName } from "../agents/registry.js";
import { resolveAgent } from "../agents/registry.js";
import type { AgentContext, AgentOptions } from "../types.js";

export type ConfigureAgentOptions = AgentOptions & {
  name: AgentName;
};

export function agent(options: ConfigureAgentOptions) {
  const resolved = resolveAgent(options.name);

  return async function (this: AgentContext): Promise<void> {
    this.agent = resolved;
    this.image = resolved.image;

    if (options.model !== undefined) {
      this.model = options.model;
    }

    await this.agent.ensureImage();
  };
}
