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

export {
  CONTAINER_AUTH_PATH,
  CURSOR_DOCKERFILE_RELATIVE,
  CURSOR_IMAGE,
  defaultHostAuthFile,
  buildDockerArgs,
  runCursorInDocker,
  cursorAgent,
  type RunCursorInDockerOptions,
} from "./agents/cursor/index.js";

export {
  CLAUDE_API_KEY_ENV,
  CLAUDE_CONTAINER_CREDENTIALS_PATH,
  CLAUDE_DOCKERFILE_RELATIVE,
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
} from "./agents/claude/index.js";

export { resolveAgent, agentRegistry } from "./agents/registry.js";
export { createAgent, type CreateAgentBindings } from "./agents/create-agent.js";
export {
  buildAgentImage,
  buildBaseImage,
  buildDockerImage,
  resetBuiltImages,
  type BuildBaseImageOptions,
} from "./agents/build-agent-image.js";
export {
  buildToolchainImage,
  resetToolchainImages,
  resolveToolchainImage,
  type BuildToolchainImageOptions,
} from "./agents/build-toolchain-image.js";
export {
  BASE_IMAGE,
  BASE_DOCKERFILE_RELATIVE,
  CONTAINER_HOME,
  CONTAINER_WORKSPACE,
} from "./agents/base/index.js";
export { PACKAGE_ROOT } from "./package-root.js";
export { ensureDockerImage } from "./agents/ensure-image.js";
export { parseAgentJsonOutput } from "./agents/parse-result.js";

export {
  buildDockerRunArgs,
  invokeDocker,
  runDocker,
  type DockerRunner,
  type DockerRunOptions,
  type DockerRunResult,
  type BuildDockerRunArgsOptions,
  type DockerVolumeMount,
} from "./agents/docker.js";

export type { RunAgentOptions, AgentRunBindingsOptions } from "./agents/types.js";
