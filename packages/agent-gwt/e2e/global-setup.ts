import "@clanker-cleanroom/cursor/register";
import "@clanker-cleanroom/claude/register";

import { DOCKER_DIR as claudeDockerDir } from "@clanker-cleanroom/claude";
import { DOCKER_DIR as cursorDockerDir } from "@clanker-cleanroom/cursor";
import { buildImages } from "../src/index.js";
import { hasClaudeCredential, hasCursorCredential } from "./credentials.js";

const agents: Array<{ name: string; available: boolean; hint: string; dockerDir: string }> = [
  {
    name: "cursor",
    available: hasCursorCredential(),
    hint: "run `agent login` on the host",
    dockerDir: cursorDockerDir,
  },
  {
    name: "claude",
    available: hasClaudeCredential(),
    hint: "set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY",
    dockerDir: claudeDockerDir,
  },
];

export default async function setup() {
  const anyAvailable = agents.some((agent) => agent.available);
  if (!anyAvailable) {
    process.stderr.write("[e2e] No agent credentials present; skipping image builds.\n");
    return;
  }

  for (const agent of agents) {
    if (!agent.available) {
      process.stderr.write(
        `[e2e] No ${agent.name} credential (${agent.hint}); its tests will skip.\n`,
      );
    }
  }

  await buildImages();
  for (const agent of agents) {
    if (agent.available) {
      await buildImages({ dir: agent.dockerDir });
    }
  }
}
