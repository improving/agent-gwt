export type {
  AgentContext,
  AgentResult,
  Agent,
  AgentOptions,
  AgentName,
  ConfigureAgentOptions,
} from "./types.js";

export { a_workspace, cleanup_workspace, AGENTS_GWT_TMP_ROOT } from "./given/a_workspace.js";
export { copy_to_workspace, type CopyToWorkspaceOptions } from "./given/copy_to_workspace.js";
export { the_prompt } from "./given/the_prompt.js";
export { executing_the_agent } from "./when/executing_the_agent.js";
export { agent } from "./given/agent.js";

// Soft-break re-exports from clanker-cleanroom
export {
  CONTAINER_AUTH_PATH,
  CURSOR_IMAGE,
  defaultHostAuthFile,
  buildDockerArgs,
  runCursorInDocker,
  cursorAgent,
  type RunCursorInDockerOptions,
  CLAUDE_API_KEY_ENV,
  CLAUDE_CONTAINER_CREDENTIALS_PATH,
  CLAUDE_IMAGE,
  CLAUDE_OAUTH_TOKEN_ENV,
  defaultClaudeHostCredentialsFile,
  buildClaudeDockerArgs,
  resolveClaudeCredentials,
  runClaudeInDocker,
  claudeAgent,
  type ClaudeAgentResult,
  type ClaudeCredentials,
  type RunClaudeInDockerOptions,
  resolveAgent,
  agentRegistry,
  createAgent,
  type CreateAgentBindings,
  buildImages,
  resetBuildMemo,
  type BuildImagesOptions,
  resolveImage,
  readRegistry,
  resetRegistry,
  BASE_IMAGE,
  CONTAINER_HOME,
  CONTAINER_WORKSPACE,
  PACKAGE_ROOT,
  ensureDockerImage,
  parseAgentJsonOutput,
  buildDockerRunArgs,
  invokeDocker,
  runDocker,
  run,
  type RunOptions,
  type DockerRunner,
  type DockerRunOptions,
  type DockerRunResult,
  type BuildDockerRunArgsOptions,
  type DockerVolumeMount,
  type RunAgentOptions,
  type AgentRunBindingsOptions,
} from "clanker-cleanroom";

/** @deprecated Prefer `buildImages()`. Builds all stock agent images. */
export async function buildAgentImage(_name?: string): Promise<void> {
  const { buildImages } = await import("clanker-cleanroom");
  await buildImages();
}
