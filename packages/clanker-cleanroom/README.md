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

`buildImages()` topo-sorts `*.Dockerfile` files by local `FROM` tags, builds in order, and records tags in `clanker-cleanroom.images.json` at the project root (build once, run many). Each entry stores the Docker tag and, when applicable, which stock agent binding to use (`cursor` or `claude`) inferred from the `FROM` chain.

| Image                      | Role                                        |
| -------------------------- | ------------------------------------------- |
| `clanker-cleanroom/base`   | Shared Arch Linux base (`yay` + `aur` user) |
| `clanker-cleanroom/cursor` | Cursor CLI on top of the base               |
| `clanker-cleanroom/claude` | Claude Code CLI on top of the base          |

Each Dockerfile's **first line** is the image tag (and the name you pass to `new Agent(...)`):

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
# cursor:node
FROM clanker-cleanroom/cursor

USER aur
RUN yay -S --noconfirm --needed nodejs npm
USER root
```

```ts
await buildImages(); // stock
await buildImages({ dir: "./docker/toolchains" });
```

The registry records `agent: "cursor"` for `cursor:node` automatically. No need to say which base agent it came from when running.

## Run an agent

One lookup for stock and toolchain names:

```ts
import { Agent } from "clanker-cleanroom";

await new Agent("cursor").run({
  workspace: "/tmp/ws",
  prompt: "Write Hello to README.md",
  model: "auto",
});

await new Agent("cursor:node").run({
  workspace: "/tmp/ws",
  prompt: "Install deps and run tests",
  model: "auto",
});

// result: AgentRunResult — durationMs, costUsd, usage (null when unavailable)
```

Convenience instances `cursorAgent` / `claudeAgent` are `new Agent("cursor")` / `new Agent("claude")`.

### Custom binding

```ts
import { Agent, type AgentBinding } from "clanker-cleanroom";

const binding: AgentBinding = {
  image: "my-agent:latest",
  displayName: "MyAgent",
  command: ({ prompt, model }) => [/* argv */],
  prepare: async () => ({ volumes: [/* … */], env: {/* docker CLI env */} }),
  parseResult: (stdout) => ({/* AgentRunResult */}),
};

await Agent.fromBinding(binding).run({ workspace, prompt });
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

| Export                                       | Role                                                           |
| -------------------------------------------- | -------------------------------------------------------------- |
| `Agent`                                      | `new Agent(name)` — stock short name or registry tag           |
| `buildImages(opts?)`                         | Topo-build a Dockerfile folder (default: package stock images) |
| `cursorAgent` / `claudeAgent`                | `new Agent("cursor")` / `new Agent("claude")`                  |
| `cursorBinding` / `claudeBinding`            | Command, prepare, parseResult for each CLI                     |
| `bindingRegistry`                            | Stock bindings keyed by `"cursor"` \| `"claude"`               |
| `createAgent(binding)` / `Agent.fromBinding` | Wrap a custom binding                                          |
| `runBoundAgent(binding, options)`            | Shared docker orchestration                                    |
| `AgentRunResult`                             | Normalized metrics; missing fields are `null`                  |
| `resolveImage` / `readRegistry`              | Read `clanker-cleanroom.images.json`                           |
| `ensureDockerImage`                          | Assert an image exists (`docker image inspect`)                |
| `buildDockerRunArgs` / `runDocker`           | Lower-level docker helpers                                     |
| `PACKAGE_ROOT`                               | Absolute path to this package (stock `docker/` lives here)     |

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) and [PUBLISHING.md](../../PUBLISHING.md).
