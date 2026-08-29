import { buildDockerImage } from "./build-agent-image.js";
import { ensureDockerImage } from "./ensure-image.js";
import type { Agent, AgentResult, AgentRunBindingsOptions, RunAgentOptions } from "./types.js";

export type CreateAgentBindings = {
  dockerfileRelative: string;
  packageRoot: string;
  image: string;
  run: (options: AgentRunBindingsOptions) => Promise<AgentResult>;
};

export function createAgent(bindings: CreateAgentBindings): Agent {
  return {
    image: bindings.image,
    ensureImage: async () => {
      await ensureDockerImage(bindings.image);
    },
    buildImage: async () => {
      await buildDockerImage(bindings.image, {
        dockerfileRelative: bindings.dockerfileRelative,
        packageRoot: bindings.packageRoot,
      });
    },
    run: (options: RunAgentOptions) =>
      bindings.run({
        ...options,
        image: bindings.image,
      }),
  };
}
