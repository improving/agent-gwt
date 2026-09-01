import { buildImages, type BuildImagesOptions } from "../images/build.js";
import { readRegistry, type RegistryOptions } from "../images/registry.js";
import { resolveBinding } from "./binding-registry.js";
import { ensureDockerImage } from "./ensure-image.js";
import { runBoundAgent } from "./run-bound.js";
import { isStockAgentName } from "./stock.js";
import type { AgentBinding, AgentRunResult, RunAgentOptions } from "./types.js";

type FromBinding = {
  readonly __fromBinding: AgentBinding;
};

/**
 * Resolve a stock short name (`cursor`, `claude`) or a registry image tag
 * (`cursor:node`) and run it with the matching binding.
 */
export class Agent {
  readonly name: string;
  readonly image: string;
  private readonly binding: AgentBinding;
  private readonly registryOptions: RegistryOptions;

  constructor(name: string, options?: RegistryOptions);
  constructor(fromBinding: FromBinding);
  constructor(nameOrBinding: string | FromBinding, options: RegistryOptions = {}) {
    if (typeof nameOrBinding !== "string") {
      const binding = nameOrBinding.__fromBinding;
      this.name = binding.image;
      this.image = binding.image;
      this.binding = binding;
      this.registryOptions = {};
      return;
    }

    const resolved = lookupAgent(nameOrBinding, options);
    this.name = nameOrBinding;
    this.image = resolved.image;
    this.binding = resolved.binding;
    this.registryOptions = options;
  }

  /** Wrap a custom binding that is not registered by name. */
  static fromBinding(binding: AgentBinding): Agent {
    return new Agent({ __fromBinding: binding });
  }

  async ensureImage(): Promise<void> {
    await ensureDockerImage(this.image);
  }

  async buildImage(options?: BuildImagesOptions): Promise<void> {
    await buildImages({ ...this.registryOptions, ...options });
  }

  run(options: RunAgentOptions): Promise<AgentRunResult> {
    return runBoundAgent(this.binding, {
      workspace: options.workspace,
      prompt: options.prompt,
      image: options.image ?? this.image,
      ...(options.model !== undefined ? { model: options.model } : {}),
    });
  }
}

function lookupAgent(
  name: string,
  options: RegistryOptions,
): { image: string; binding: AgentBinding } {
  if (isStockAgentName(name)) {
    const binding = resolveBinding(name);
    return { image: binding.image, binding };
  }

  const entry = readRegistry(options).images[name];
  if (entry === undefined) {
    throw new Error(
      `Unknown agent "${name}". Use a stock name ("cursor", "claude") or a tag ` +
        `recorded in clanker-cleanroom.images.json via buildImages().`,
    );
  }

  if (entry.agent === undefined) {
    throw new Error(`Image "${name}" is not a runnable agent (no stock agent in its FROM chain).`);
  }

  const stockBinding = resolveBinding(entry.agent);
  const binding: AgentBinding = { ...stockBinding, image: entry.image };
  return { image: entry.image, binding };
}
