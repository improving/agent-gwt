# clanker-cleanroom

Build and run coding-agent Docker images with a disposable workspace and **credentials-only** mounts.

This package is the shared runtime: `Agent`, docker orchestration, image build/registry, and a pluggable binding registry. Stock agents live in separate packages:

- [`@clanker-cleanroom/cursor`](../clanker-cleanroom-cursor)
- [`@clanker-cleanroom/claude`](../clanker-cleanroom-claude)

For Given/When/Then test steps on top of this library, see [`agent-gwt`](../agent-gwt).

## Install

```bash
pnpm add -D clanker-cleanroom
# plus the agent(s) you use:
pnpm add -D @clanker-cleanroom/cursor   # and/or @clanker-cleanroom/claude
```

## Prerequisites

1. Docker
2. Host login for the agent(s) you use (see the agent package README)

## Register an agent

Stock short names only resolve after registration:

```ts
import "@clanker-cleanroom/cursor/register";
import { Agent } from "clanker-cleanroom";

await new Agent("cursor").run({
  workspace: "/tmp/ws",
  prompt: "Write Hello to README.md",
  model: "auto",
});
```

Or call `registerBinding(name, binding)` yourself. `Agent.fromBinding(binding)` / `createAgent(binding)` never need registration.

## Build images

```ts
import "@clanker-cleanroom/cursor/register";
import { buildImages } from "clanker-cleanroom";
import { DOCKER_DIR as cursorDocker } from "@clanker-cleanroom/cursor";

await buildImages(); // base image from this package
await buildImages({ dir: cursorDocker }); // agent image from its package
```

`buildImages()` topo-sorts `*.Dockerfile` files by local `FROM` tags, builds in order, and records tags in `clanker-cleanroom.images.json` at the project root. Each entry stores the Docker tag and, when applicable, which registered stock binding to use (inferred from the `FROM` chain — register before building toolchains).

| Image                      | Package                         | Role                                        |
| -------------------------- | ------------------------------- | ------------------------------------------- |
| `clanker-cleanroom/base`   | `clanker-cleanroom`             | Shared Arch Linux base (`yay` + `aur` user) |
| `clanker-cleanroom/cursor` | `@clanker-cleanroom/cursor`     | Cursor CLI on top of the base               |
| `clanker-cleanroom/claude` | `@clanker-cleanroom/claude`     | Claude Code CLI on top of the base          |

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
# cursor:node
FROM clanker-cleanroom/cursor

USER aur
RUN yay -S --noconfirm --needed nodejs npm
USER root
```

```ts
import "@clanker-cleanroom/cursor/register";
import { buildImages } from "clanker-cleanroom";
import { DOCKER_DIR as cursorDocker } from "@clanker-cleanroom/cursor";

await buildImages();
await buildImages({ dir: cursorDocker });
await buildImages({ dir: "./docker/toolchains" });
```

The registry records `agent: "cursor"` for `cursor:node` automatically.

## Run an agent

```ts
import "@clanker-cleanroom/cursor/register";
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
```

Convenience instances live on the agent packages (`cursorAgent` / `claudeAgent` via `Agent.fromBinding`).

### Cancel / AbortSignal

Pass an `AbortSignal` to stop an in-flight run promptly (force-remove the named container and any nested DooD descendants). The promise rejects with `AgentAbortError` (`error.name === "AbortError"`), which carries best-effort `result` metrics from whatever trajectory was written before abort.

```ts
import "@clanker-cleanroom/cursor/register";
import { Agent, AgentAbortError } from "clanker-cleanroom";

const ac = new AbortController();
const run = new Agent("cursor").run({
  workspace: "/tmp/ws",
  prompt: "…",
  signal: ac.signal,
});

// later (Ctrl+C, timeout, UI Stop, …)
ac.abort();

try {
  await run;
} catch (error) {
  if (error instanceof AgentAbortError) {
    console.log(error.result); // tokens/cost when the CLI already wrote a result event
  }
  throw error;
}
```

After abort, `agent.trajectory()` / `agent.sessionId()` still reflect any NDJSON that landed under `/agent/output` (same as a failed run).

### Multi-turn (session resume)

The same `Agent` instance resumes the prior CLI session on every `run()` after the first. The session id is stored on the instance; session files are staged on the host and remounted into the container (Cursor: `~/.cursor/chats`, Claude: `~/.claude/projects/-workspace` only — not the whole home dir).

```ts
const agent = new Agent("cursor");

await agent.run({ workspace, prompt: "Create README.md with Hello" });
await agent.run({ workspace, prompt: "Append a Usage section" }); // resumes

await agent.resetSession(); // fresh session on the next run
```

Call `agent.sessionId()` to inspect the captured id. Output is still cleared between runs; input and session data are not.

### Custom binding

```ts
import { Agent, type AgentBinding } from "clanker-cleanroom";

const binding: AgentBinding = {
  image: "my-agent:latest",
  displayName: "MyAgent",
  trajectoryKind: "custom",
  adaptEvents: (raw) => [/* TrajectoryEvent[] */],
  command: ({ prompt, model }) => [/* argv */],
  prepare: async () => ({ volumes: [/* … */], env: {/* docker CLI env */} }),
  parseResult: (trajectory) => ({/* AgentRunResult */}),
};

await Agent.fromBinding(binding).run({ workspace, prompt });
```

## What a run does

1. `prepare` resolves host credentials → volume mounts and/or docker-CLI env (secrets never appear on argv when using env passthrough)
2. Mounts the workspace at `/workspace`, staged input at `/agent/input` (read-only), output at `/agent/output`, and (when the binding defines `sessionDataPath`) the instance session store; then runs as your host uid/gid
3. Invokes the agent CLI with `--output-format stream-json` (and `--resume <id>` after the first turn), redirecting stdout to `/agent/output/trajectory` inside the container
4. Reads that trajectory file, stores `sessionId` on the `Agent` instance, and returns `AgentRunResult` metrics from the terminal `result` event

### Input / output mounts

Each `Agent` has `input` and `output` trees (host temp dirs) bind-mounted on every run:

```ts
import "@clanker-cleanroom/cursor/register";
import { Agent } from "clanker-cleanroom";

const agent = new Agent("cursor");

await agent.input.write("spec.json", JSON.stringify({ name: "demo" }));

await agent.run({
  workspace: "/tmp/ws",
  prompt: "Read /agent/input/spec.json and write /agent/output/result.txt",
});

const result = await agent.output.readText("result.txt");
const trajectory = await agent.trajectory();
```

- **Input** is mounted read-only at `/agent/input` and persists across runs until `agent.input.clear()`
- **Output** is mounted read-write at `/agent/output` and is cleared at the start of each `run()`
- **Session** (when the binding sets `sessionDataPath`) persists across runs until `agent.resetSession()`
- Each run streams CLI NDJSON to `/agent/output/trajectory`. Inspect with `agent.trajectory()` or `parseTrajectory(ndjson, kind, adaptEvents)`.
- Paths must be relative (no `..`); `write` accepts `string | Uint8Array`

### Nested agents (Docker-outside-of-Docker)

When an agent container itself calls `Agent.run` against the **host** Docker socket, `-v` paths must be host paths. Pass `remaps` on the **outer** run to nest a prefix map into the child; that run’s own mounts are **not** rewritten. Inner runs read `CLANKER_PATH_REMAPS` and rewrite every volume host path before `docker run`. Additional `remaps` on an inner run are composed through the inherited map so nesting always resolves to the root host — inner code does not forward remaps manually.

```ts
import "@clanker-cleanroom/cursor/register";
import { Agent } from "clanker-cleanroom";

// Host: inject remaps for descendants; this run's -v hosts stay as given
await new Agent("cursor").run({
  workspace: "/tmp/ws",
  prompt: "…",
  remaps: {
    "/inside/path": "/host/path",
  },
});

// Inside Agent:1 — no remaps in code; volumes under /inside/path are rewritten to /host/path
// await new Agent("cursor").run({ workspace: "/inside/path/job", prompt: "…" });
```

| Level | `run({ remaps })` | This run’s `-v` hosts | Child receives |
| ----- | ----------------- | --------------------- | -------------- |
| Host | `R0` | Unchanged | `R0` via `CLANKER_PATH_REMAPS` |
| Nested | optional `R1` | Rewritten with inherited | `compose(inherited, R1)` |

Keys and values should be absolute paths. The longest matching key prefix wins.

Nested containers are siblings on the **host** Docker daemon, not cgroup children of the outer container. Every agent `docker run` gets a unique `--name` plus labels (`clanker.name`, `clanker.parent`, `clanker.root`) and injects `CLANKER_DOCKER_NAME` / `CLANKER_DOCKER_ROOT` into the child (same pattern as remaps). Host `signal.abort()` runs `forceRemoveContainerTree` so DooD descendants are reaped even when the outer Node process never gets to clean up.

## Isolation

- **Credentials only** — agent packages mount credentials only (no host settings/MCP/skills)
- **Non-root** — container process uses host uid/gid so workspace files are owned by you
- **Writable host mounts** — workspace (`/workspace`) and output (`/agent/output`); input is read-only

## Exports

| Export                                       | Role                                                           |
| -------------------------------------------- | -------------------------------------------------------------- |
| `Agent`                                      | `new Agent(name)` — registered stock name or registry tag      |
| `Agent.sessionId()` / `Agent.resetSession()` | Inspect or clear the instance CLI session                      |
| `AgentAbortError`                            | Abort reject; `name === "AbortError"`, best-effort `.result`   |
| `registerBinding` / `resetBindings`          | Pluggable stock binding registry                               |
| `AgentFs` / `agent.input` / `agent.output`   | Stage files for `/agent/input` (ro) and `/agent/output`        |
| `Agent.trajectory()`                         | Normalize the last run's `trajectory` NDJSON                   |
| `TRAJECTORY_FILE` / `parseTrajectory`        | Filename + shared trajectory parser (pass `adaptEvents`)       |
| `CONTAINER_INPUT` / `CONTAINER_OUTPUT`       | Container mount paths for staged I/O                           |
| `buildImages(opts?)`                         | Topo-build a Dockerfile folder (default: base image only)      |
| `createAgent(binding)` / `Agent.fromBinding` | Wrap a custom binding                                          |
| `runBoundAgent(binding, options)`            | Shared docker orchestration                                    |
| `remaps` / `CLANKER_PATH_REMAPS`             | Nested DooD path remaps (inject down, apply on inner runs)     |
| `CLANKER_DOCKER_NAME` / `forceRemoveContainerTree` | DooD cancel tree identity + subtree cleanup              |
| `AgentRunResult`                             | Normalized metrics; missing fields are `null`                  |
| `resolveImage` / `readRegistry`              | Read `clanker-cleanroom.images.json`                           |
| `ensureDockerImage`                          | Assert an image exists (`docker image inspect`)                |
| `buildDockerRunArgs` / `runDocker`           | Lower-level docker helpers                                     |
| `PACKAGE_ROOT`                               | Absolute path to this package (`docker/` with base lives here) |

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) and [PUBLISHING.md](../../PUBLISHING.md).
