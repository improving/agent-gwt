# clanker-cleanroom

Build and run coding-agent Docker images with a disposable workspace and **credentials-only** mounts.

Stock images ship inside this package. Agent-specific folders own command argv, credential mounts/env, and parsing CLI JSON into normalized metrics. Shared orchestration (`runBoundAgent`) owns `docker run`.

For Given/When/Then test steps on top of this library, see [`agent-gwt`](../agent-gwt).

## Install

```bash
pnpm add -D clanker-cleanroom
```

## Prerequisites

1. Docker
2. Host login for the agent(s) you use:
   - **Cursor:** `agent login` so `~/.config/cursor/auth.json` exists
   - **Claude Code:** `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) **or** `ANTHROPIC_API_KEY` **or** a Linux host's `~/.claude/.credentials.json` (checked in that order). macOS keeps Claude login in the Keychain — set a token or API key on a Mac.

## Build images

```ts
import { buildImages } from "clanker-cleanroom";

await buildImages(); // stock docker/ from this package
```

`buildImages()` topo-sorts `*.Dockerfile` files by local `FROM` tags, builds in order, and records tags in `clanker-cleanroom.images.json` at the project root (build once, run many). Skip rebuilds when the registry entry exists and `docker image inspect` succeeds; pass `{ force: true }` to rebuild.

| Image                      | Role                                        |
| -------------------------- | ------------------------------------------- |
| `clanker-cleanroom/base`   | Shared Arch Linux base (`yay` + `aur` user) |
| `clanker-cleanroom/cursor` | Cursor CLI on top of the base               |
| `clanker-cleanroom/claude` | Claude Code CLI on top of the base          |

Each Dockerfile's **first line** is the image tag:

```dockerfile
# clanker-cleanroom/cursor
FROM clanker-cleanroom/base
…
```

### Apple Silicon

The official `archlinux` image is x86_64-only. On an arm64 Docker host:

```bash
export DOCKER_DEFAULT_PLATFORM=linux/amd64
```

### Extending with toolchains

```dockerfile
# my-app/cursor-node
FROM clanker-cleanroom/cursor

USER aur
RUN yay -S --noconfirm --needed nodejs npm
USER root
```

```ts
await buildImages(); // stock
await buildImages({ dir: "./docker/toolchains" });
```

Tags land in the same `clanker-cleanroom.images.json`. Resolve later with `resolveImage("my-app/cursor-node")` or pass the tag as `image` when running.

## Run an agent

### Stock agents

```ts
import { cursorAgent, claudeAgent } from "clanker-cleanroom";

const result = await cursorAgent.run({
  workspace: "/tmp/ws",
  prompt: "Write Hello to README.md",
  model: "auto",
});

// result: AgentRunResult — durationMs, costUsd, usage (null when unavailable)
```

Or look up by name:

```ts
import { resolveAgent } from "clanker-cleanroom";

await resolveAgent("claude").run({ workspace, prompt, model: "sonnet" });
```

### Registry tag / toolchain image

```ts
import { run, CURSOR_IMAGE } from "clanker-cleanroom";

await run("my-app/cursor-node", {
  workspace,
  prompt,
  agent: CURSOR_IMAGE, // which credentials/command binding to use
});
```

Exact stock tags (`clanker-cleanroom/cursor`, `…/claude`) infer the binding; toolchain images need `agent`.

### Custom binding

```ts
import { createAgent, runBoundAgent, type AgentBinding } from "clanker-cleanroom";

const binding: AgentBinding = {
  image: "my-agent:latest",
  displayName: "MyAgent",
  command: ({ prompt, model }) => [/* argv */],
  prepare: async () => ({ volumes: [/* … */], env: { /* docker CLI env */ } }),
  parseResult: (stdout) => ({ /* AgentRunResult */ }),
};

const agent = createAgent(binding);
await agent.run({ workspace, prompt });
// or: await runBoundAgent(binding, { workspace, prompt, image: binding.image });
```

## What a run does

1. `prepare` resolves host credentials → volume mounts and/or docker-CLI env (secrets never appear on argv when using env passthrough)
2. Mounts the workspace at `/workspace` and runs as your host uid/gid
3. Invokes the agent CLI with JSON output
4. Returns `AgentRunResult` metrics (`durationMs`, `costUsd`, `usage`) — dialog text is discarded

Cursor mounts `~/.config/cursor/auth.json` read-only (`costUsd` is always `null` today). Claude forwards `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` by env **name**, or mounts `.credentials.json` read-only.

## Isolation

- **Credentials only** — no host `~/.cursor` / `~/.claude` settings, MCP, skills, or projects
- **Non-root** — container process uses host uid/gid so workspace files are owned by you
- **Workspace is the only writable host path**

## Exports

| Export | Role |
| --- | --- |
| `buildImages(opts?)` | Topo-build a Dockerfile folder (default: package stock images) |
| `cursorAgent` / `claudeAgent` | Ready-made `Agent` instances |
| `cursorBinding` / `claudeBinding` | Command, prepare, parseResult for each CLI |
| `resolveAgent` / `agentRegistry` | Look up stock agents by name |
| `createAgent(binding)` | Wrap a binding as `{ run, ensureImage, buildImage }` |
| `runBoundAgent(binding, options)` | Shared docker orchestration |
| `run(tag, options)` | Resolve registry tag (or image) and run with a stock binding |
| `AgentRunResult` | Normalized metrics; missing fields are `null` |
| `resolveImage` / `readRegistry` | Read `clanker-cleanroom.images.json` |
| `ensureDockerImage` | Assert an image exists (`docker image inspect`) |
| `buildDockerRunArgs` / `runDocker` | Lower-level docker helpers |
| `PACKAGE_ROOT` | Absolute path to this package (stock `docker/` lives here) |

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) and [PUBLISHING.md](../../PUBLISHING.md).
