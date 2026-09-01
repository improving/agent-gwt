import { buildImages } from "../images/build.js";
import { ensureDockerImage } from "./ensure-image.js";
import type { Agent, AgentResult, AgentRunBindingsOptions, RunAgentOptions } from "./types.js";

export type CreateAgentBindings = {
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
      await buildImages();
    },
    run: (options: RunAgentOptions) =>
      bindings.run({
        ...options,
        image: options.image ?? bindings.image,
      }),
  };
}
