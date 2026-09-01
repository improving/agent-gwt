import { type AgentName, buildImages } from "../src/index.js";
import { hasClaudeCredential, hasCursorCredential } from "./credentials.js";

const agents: Array<{ name: AgentName; available: boolean; hint: string }> = [
  { name: "cursor", available: hasCursorCredential(), hint: "run `agent login` on the host" },
  {
    name: "claude",
    available: hasClaudeCredential(),
    hint: "set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY",
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
}
