export type {
  Agent,
  AgentOptions,
  AgentResult,
  AgentRunBindingsOptions,
  BuildDockerRunArgsOptions,
  DockerRunOptions,
  DockerRunResult,
  DockerRunner,
  DockerVolumeMount,
  EnsureDockerImageOptions,
  RunAgentOptions,
} from "./agents/types.js";

export {
  buildDockerRunArgs,
  invokeDocker,
  runDocker,
} from "./agents/docker.js";

export { ensureDockerImage } from "./agents/ensure-image.js";
export { parseAgentJsonOutput } from "./agents/parse-result.js";
export { createAgent, type CreateAgentBindings } from "./agents/create-agent.js";
export { resolveAgent, agentRegistry, type AgentName } from "./agents/registry.js";
export { run, type RunOptions } from "./agents/run.js";

export {
  CONTAINER_AUTH_PATH,
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

export { BASE_IMAGE, CONTAINER_HOME, CONTAINER_WORKSPACE } from "./agents/base/index.js";

export { PACKAGE_ROOT } from "./package-root.js";

export { buildImages, resetBuildMemo, type BuildImagesOptions } from "./images/build.js";
export {
  resolveImage,
  readRegistry,
  resetRegistry,
  registryPath,
  IMAGES_REGISTRY_FILENAME,
  type ImageRegistry,
  type ImageRegistryEntry,
  type RegistryOptions,
} from "./images/registry.js";
export { parseDockerfiles, type DockerfileEntry } from "./images/parse.js";
export { topoSort } from "./images/graph.js";
