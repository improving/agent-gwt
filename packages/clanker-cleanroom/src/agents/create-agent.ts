import { buildImages } from "../images/build.js";
import { ensureDockerImage } from "./ensure-image.js";
import { runBoundAgent } from "./run-bound.js";
import type { Agent, AgentBinding, RunAgentOptions } from "./types.js";

export type CreateAgentBindings = AgentBinding;

export function createAgent(binding: AgentBinding): Agent {
  return {
    image: binding.image,
    ensureImage: async () => {
      await ensureDockerImage(binding.image);
    },
    buildImage: async () => {
      await buildImages();
    },
    run: (options: RunAgentOptions) =>
      runBoundAgent(binding, {
        ...options,
        image: options.image ?? binding.image,
      }),
  };
}
