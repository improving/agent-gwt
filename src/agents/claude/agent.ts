import { PACKAGE_ROOT } from "../../package-root.js";
import { createAgent } from "../create-agent.js";
import { CLAUDE_DOCKERFILE_RELATIVE, CLAUDE_IMAGE } from "./constants.js";
import { runClaudeInDocker } from "./run.js";

export const claudeAgent = createAgent({
  dockerfileRelative: CLAUDE_DOCKERFILE_RELATIVE,
  packageRoot: PACKAGE_ROOT,
  image: CLAUDE_IMAGE,
  run: runClaudeInDocker,
});
