import { createAgent } from "../create-agent.js";
import { CLAUDE_IMAGE } from "./constants.js";
import { runClaudeInDocker } from "./run.js";

export const claudeAgent = createAgent({
  image: CLAUDE_IMAGE,
  run: runClaudeInDocker,
});
