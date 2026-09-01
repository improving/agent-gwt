import { resolveImage } from "../images/registry.js";
import { ensureDockerImage } from "./ensure-image.js";
import { claudeBinding } from "./claude/binding.js";
import { CLAUDE_IMAGE } from "./claude/constants.js";
import { cursorBinding } from "./cursor/binding.js";
import { CURSOR_IMAGE } from "./cursor/constants.js";
import { runBoundAgent } from "./run-bound.js";
import type { AgentBinding, AgentRunResult, DockerRunner } from "./types.js";

export type RunOptions = {
  workspace: string;
  prompt: string;
  model?: string;
  /**
   * Stock agent whose credentials/command to use when `tag` is a toolchain image.
   * Defaults to inferring from exact stock tags (`clanker-cleanroom/cursor` / `.../claude`).
   */
  agent?: typeof CURSOR_IMAGE | typeof CLAUDE_IMAGE;
  dockerRunner?: DockerRunner;
};

/**
 * Resolve a registry tag (or absolute image name) and run it with workspace bindings.
 */
export async function run(
  tagOrOptions: string | ({ image: string } & RunOptions),
  options?: RunOptions,
): Promise<AgentRunResult> {
  if (typeof tagOrOptions === "string") {
    if (options === undefined) {
      throw new Error("run(tag, options) requires options with workspace and prompt");
    }
    const image = resolveImage(tagOrOptions) ?? tagOrOptions;
    return runImage(image, options);
  }

  return runImage(tagOrOptions.image, tagOrOptions);
}

async function runImage(image: string, options: RunOptions): Promise<AgentRunResult> {
  const ensureOptions =
    options.dockerRunner === undefined ? {} : { dockerRunner: options.dockerRunner };
  await ensureDockerImage(image, ensureOptions);

  const binding = resolveBinding(options.agent ?? inferAgent(image), image);
  return runBoundAgent(
    binding,
    {
      workspace: options.workspace,
      prompt: options.prompt,
      image,
      ...(options.model !== undefined ? { model: options.model } : {}),
    },
    options.dockerRunner,
  );
}

function resolveBinding(
  agent: typeof CURSOR_IMAGE | typeof CLAUDE_IMAGE | undefined,
  image: string,
): AgentBinding {
  if (agent === CURSOR_IMAGE) {
    return { ...cursorBinding, image };
  }
  if (agent === CLAUDE_IMAGE) {
    return { ...claudeBinding, image };
  }
  throw new Error(
    `Cannot run image ${image}: unknown agent binding. Pass agent: "${CURSOR_IMAGE}" or "${CLAUDE_IMAGE}".`,
  );
}

function inferAgent(image: string): typeof CURSOR_IMAGE | typeof CLAUDE_IMAGE | undefined {
  if (image === CURSOR_IMAGE) {
    return CURSOR_IMAGE;
  }
  if (image === CLAUDE_IMAGE) {
    return CLAUDE_IMAGE;
  }
  return undefined;
}
