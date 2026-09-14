# @clanker-cleanroom/claude

Claude Code binding and Docker image for [`clanker-cleanroom`](../clanker-cleanroom).

## Install

```bash
pnpm add -D clanker-cleanroom @clanker-cleanroom/claude
```

## Usage

```ts
import "@clanker-cleanroom/claude/register";
import { Agent, buildImages } from "clanker-cleanroom";
import { DOCKER_DIR as claudeDocker, claudeAgent } from "@clanker-cleanroom/claude";

await buildImages();
await buildImages({ dir: claudeDocker });

await new Agent("claude").run({ workspace, prompt, model: "sonnet" });
// or without registration:
await claudeAgent.run({ workspace, prompt, model: "sonnet" });
```

## Prerequisites

Set `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) **or** `ANTHROPIC_API_KEY` **or** provide a Linux host's `~/.claude/.credentials.json` (checked in that order). macOS keeps Claude login in the Keychain — set a token or API key on a Mac.

## Exports

| Export | Role |
| --- | --- |
| `claudeBinding` | Command, prepare, parseResult, adaptEvents |
| `claudeAgent` | `Agent.fromBinding(claudeBinding)` |
| `resolveClaudeCredentials` / `credentialsEnv` | Host credential resolution |
| `CLAUDE_IMAGE` / credential env constants | Image tag and env names |
| `adaptClaudeEvents` | Trajectory adapter |
| `DOCKER_DIR` / `PACKAGE_ROOT` | Dockerfile folder for `buildImages({ dir })` |
| `@clanker-cleanroom/claude/register` | Side-effect: `registerBinding("claude", claudeBinding)` |
