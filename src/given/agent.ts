import { resolveToolchainImage } from "../agents/build-toolchain-image.js";
import type { AgentName } from "../agents/registry.js";
import { resolveAgent } from "../agents/registry.js";
import { ensureDockerImage } from "../agents/ensure-image.js";
import type { AgentContext, AgentOptions } from "../types.js";

export type ConfigureAgentOptions = AgentOptions & {
  name: AgentName;
};

export function agent(options: ConfigureAgentOptions) {
  const resolved = resolveAgent(options.name);

  return async function (this: AgentContext): Promise<void> {
    this.agent = resolved;
    this.image = resolveAgentImage(options, resolved.image);

    if (options.model !== undefined) {
      this.model = options.model;
    }

    await ensureDockerImage(this.image);
  };
}

function resolveAgentImage(options: ConfigureAgentOptions, defaultImage: string): string {
  if (options.image !== undefined && options.variant !== undefined) {
    throw new Error(
      `agent({ name: "${options.name}" }) cannot set both image and variant; pick one.`,
    );
  }

  if (options.image !== undefined) {
    return options.image;
  }

  if (options.variant !== undefined) {
    const image = resolveToolchainImage(options.name, options.variant);
    if (image === undefined) {
      throw new Error(
        `Unknown toolchain variant "${options.variant}" for agent "${options.name}". ` +
          `Call buildToolchainImage("${options.variant}", { agent: "${options.name}", ... }) ` +
          `from vitest globalSetup before running tests.`,
      );
    }
    return image;
  }

  return defaultImage;
}
