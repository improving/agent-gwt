export type {
  AgentBinding,
  AgentOptions,
  AgentPrepareResult,
  AgentRunBindingsOptions,
  AgentRunResult,
  BuildDockerRunArgsOptions,
  DockerRunOptions,
  DockerRunResult,
  DockerRunner,
  DockerVolumeMount,
  EnsureDockerImageOptions,
  RunAgentOptions,
  TokenUsage,
} from "./agents/types.js";

export { emptyTokenUsage, readTokenCount } from "./agents/types.js";

export { buildDockerRunArgs, invokeDocker, runDocker } from "./agents/docker.js";

export { ensureDockerImage } from "./agents/ensure-image.js";
export { parseAgentJsonOutput } from "./agents/parse-result.js";
export { Agent } from "./agents/agent.js";
export { createAgent, type CreateAgentBindings } from "./agents/create-agent.js";
export { bindingRegistry, type AgentName, type StockAgentName } from "./agents/registry.js";
export { isStockAgentName, stockAgentNameForImage, STOCK_AGENT_IMAGES } from "./agents/stock.js";
export { runBoundAgent, type RunBoundAgentOptions } from "./agents/run-bound.js";

export {
  CONTAINER_AUTH_PATH,
  CURSOR_IMAGE,
  defaultHostAuthFile,
  cursorAgent,
  cursorBinding,
} from "./agents/cursor/index.js";

export {
  CLAUDE_API_KEY_ENV,
  CLAUDE_CONTAINER_CREDENTIALS_PATH,
  CLAUDE_IMAGE,
  CLAUDE_OAUTH_TOKEN_ENV,
  defaultClaudeHostCredentialsFile,
  resolveClaudeCredentials,
  credentialsEnv,
  claudeAgent,
  claudeBinding,
  type ClaudeCredentials,
} from "./agents/claude/index.js";

export { BASE_IMAGE, CONTAINER_HOME, CONTAINER_WORKSPACE } from "./agents/base/index.js";

export { PACKAGE_ROOT } from "./package-root.js";

export { buildImages, resetBuildMemo, type BuildImagesOptions } from "./images/build.js";
export {
  resolveImage,
  readRegistry,
  resetRegistry,
  registryPath,
  upsertRegistryEntry,
  IMAGES_REGISTRY_FILENAME,
  IMAGE_REGISTRY_VERSION,
  type ImageRegistry,
  type ImageRegistryEntry,
  type RegistryOptions,
} from "./images/registry.js";
export { parseDockerfiles, type DockerfileEntry } from "./images/parse.js";
export { topoSort } from "./images/graph.js";
