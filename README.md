# agent-gwt

GWT step functions for repeatable **agent** tests. Works with [vitest-gwt](https://github.com/devzeebo/vitest-gwt) / [gwt-runner](https://github.com/devzeebo/gwt-runner).

Ships the **Cursor** and **Claude Code** agents: create a temp workspace, mount **only** the agent's credentials, run the agent as your host user, and put parsed `--output-format json` on the test context.

## Install

```bash
pnpm add -D agent-gwt vitest vitest-gwt
```

## Prerequisites

1. Docker
2. Host login for the agent(s) you use:
   - **Cursor:** `agent login` so `~/.config/cursor/auth.json` exists
   - **Claude Code:** `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token` — Claude subscription) **or** `ANTHROPIC_API_KEY` in the environment, **or** a Linux host's `~/.claude/.credentials.json`. Checked in that order. macOS keeps Claude Code's login in the Keychain, so on a Mac set one of the two variables:

     ```bash
     claude setup-token                       # prints a long-lived token
     export CLAUDE_CODE_OAUTH_TOKEN=<token>   # or: export ANTHROPIC_API_KEY=sk-ant-...
     ```
3. Build the agent Docker image **once per suite** via vitest `globalSetup` (or manually)

## Setup

Build images once in `globalSetup` so parallel test files do not race. Build only the agents your suite uses:

```ts
// vitest.global-setup.ts
import { buildAgentImage } from "agent-gwt";

export default async function setup() {
  await buildAgentImage("cursor");
  await buildAgentImage("claude");
}
```

```ts
// vite.config.ts (or vitest.config.ts)
import { defineConfig } from "vite-plus"; // or "vitest/config"

export default defineConfig({
  test: {
    globalSetup: ["./vitest.global-setup.ts"],
  },
});
```

## Usage

Wire the agent and a disposable workspace with `withAspect`, then write Given/When/Then tests. Agent runs are slow — raise the timeout.

Pick the agent with `agent({ name, model })`; nothing else in the test changes:

```ts
withAspect(agent({ name: "cursor", model: "auto" })); // Cursor CLI
withAspect(agent({ name: "claude", model: "sonnet" })); // Claude Code
```

### Simple prompt

```ts
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect } from "vitest";
import test, { withAspect, withTestOptions } from "vitest-gwt";
import {
  type AgentContext,
  a_workspace,
  agent,
  cleanup_workspace,
  executing_the_agent,
  the_prompt,
} from "agent-gwt";

describe("simple prompt", () => {
  withAspect(agent({ name: "cursor", model: "auto" }));
  withAspect(a_workspace, cleanup_workspace);

  withTestOptions((opts) => (opts.timeout = 60 * 1000));

  test("writes the readme", {
    given: {
      the_prompt: the_prompt("Write 'Hello World' to README.md"),
    },
    when: {
      executing_the_agent,
    },
    then: {
      readme_exists,
      readme_contains_HELLO_WORLD,
    },
  });
});

type Context = AgentContext & {
  // extend with your own fields
};

async function readme_exists(this: Context) {
  await access(join(this.workspace, "README.md"));
}

async function readme_contains_HELLO_WORLD(this: Context) {
  const contents = await readFile(join(this.workspace, "README.md"), "utf-8");

  expect(contents.toLowerCase()).toContain("hello world");
}
```

### Seeded workspace

Seed files in `given` before `executing_the_agent`. The agent sees them under `this.workspace`:

```ts
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect } from "vitest";
import test, { withAspect, withTestOptions } from "vitest-gwt";
import {
  type AgentContext,
  a_workspace,
  agent,
  cleanup_workspace,
  executing_the_agent,
  the_prompt,
} from "agent-gwt";

describe("with a workspace", () => {
  withAspect(agent({ name: "cursor", model: "auto" }));
  withAspect(a_workspace, cleanup_workspace);

  withTestOptions((opts) => (opts.timeout = 60 * 1000));

  test("can read the workspace", {
    given: {
      the_prompt: the_prompt(
        "read @sample.txt, and answer the question. Write a new file 'answer.sentinel' with your answer",
      ),
      sample_text_file,
    },
    when: {
      executing_the_agent,
    },
    then: {
      sentinel_file_exists,
      question_is_answered,
    },
  });
});

type Context = AgentContext & {
  // extend with your own fields
};

async function sample_text_file(this: Context) {
  await writeFile(
    join(this.workspace, "sample.txt"),
    "what is the answer to life, the universe, and everything?",
    "utf-8",
  );
}

async function sentinel_file_exists(this: Context) {
  await access(join(this.workspace, "answer.sentinel"));
}

async function question_is_answered(this: Context) {
  const contents = await readFile(join(this.workspace, "answer.sentinel"), "utf-8");

  expect(contents.toLowerCase()).toContain("42");
}
```

To copy a fixture tree instead of writing files one by one, use `copy_to_workspace`. Globs are resolved from the **current Vitest spec file’s directory** (not `process.cwd()`). Override with `{ from: import.meta.dirname }` if the files live elsewhere.

```ts
import { copy_to_workspace } from "agent-gwt";

async function tests_are_in_workspace(this: Context) {
  await copy_to_workspace(this.workspace, ["fixtures/**/*.spec.ts"]);
}
```

Optional `base` strips a matching path prefix (`*` = one folder segment). `base: "fixtures/*"` turns `fixtures/suite-a/foo.spec.ts` into `foo.spec.ts` and `fixtures/suite-b/nested/bar.spec.ts` into `nested/bar.spec.ts`.

```ts
await copy_to_workspace(this.workspace, ["fixtures/**/*.spec.ts"], {
  base: "fixtures/*",
});
```

A glob that matches no files throws. If `base` is set and any matched file does not match that prefix, the helper throws and copies nothing.

### Inspecting the result

`this.agentResult` is the parsed JSON the CLI printed, for either agent. For Claude Code, `ClaudeAgentResult` types the useful fields:

```ts
import type { ClaudeAgentResult } from "agent-gwt";

function used_one_turn(this: Context) {
  const result = this.agentResult as ClaudeAgentResult;

  expect(result.is_error).toBe(false);
  expect(result.num_turns).toBeGreaterThan(0);
  expect(result.total_cost_usd).toBeLessThan(0.5);
}
```

A Claude run whose JSON reports `is_error: true` throws from `executing_the_agent` with the agent's message, so a failing run surfaces as the real cause rather than a downstream assertion.

## Docker images

| Image                         | Role                                                             |
| ----------------------------- | ---------------------------------------------------------------- |
| `agent-gwt/base:local`        | Shared Arch Linux base (`yay` + `aur` user). Used by all agents. |
| `agent-gwt/cursor-cli:local`  | Cursor CLI on top of the base                                    |
| `agent-gwt/claude-code:local` | Claude Code CLI (native binary) on top of the base               |

`buildAgentImage("cursor")` builds the base first, then the Cursor image; `buildAgentImage("claude")` does the same for Claude Code.

### Apple Silicon

The official `archlinux` image is x86_64-only. On an arm64 Docker host, build and run under amd64 emulation:

```bash
export DOCKER_DEFAULT_PLATFORM=linux/amd64
```

Docker Desktop applies this to both `docker build` and `docker run`, so nothing in the library changes.

### Extending with toolchains

Install packages in a child image, then point tests at that tag:

```dockerfile
# docker/agent.Dockerfile
FROM agent-gwt/cursor-cli:local
# or: FROM agent-gwt/claude-code:local

# Official Arch packages (as root)
RUN pacman -Sy --noconfirm --needed nodejs npm python rust \
  && pacman -Scc --noconfirm

# AUR packages (build-time only — yay refuses root)
USER aur
RUN yay -S --noconfirm --needed some-aur-package
USER root
```

```ts
// vitest.global-setup.ts
import { buildAgentImage, buildDockerImage } from "agent-gwt";

export default async function setup() {
  await buildAgentImage("cursor");
  await buildDockerImage("my-app/agent:local", {
    dockerfileRelative: "docker/agent.Dockerfile",
    packageRoot: process.cwd(),
  });
}
```

```ts
agent({ name: "cursor", image: "my-app/agent:local", model: "auto" });
```

The base uses Arch/`pacman` (glibc). Alpine will not run the Cursor CLI.

## What `agent` does

Suite-level `withAspect` **before** hook that:

1. Resolves `name` via the agents registry and sets `this.agent`
2. Sets `this.model` when provided; sets `this.image` from `options.image` or the resolved agent
3. Asserts that Docker image already exists (`docker image inspect`) — it does **not** build. Build once in `globalSetup` with `buildAgentImage(...)` so parallel test files do not race

Pair workspace lifecycle separately: `withAspect(a_workspace, cleanup_workspace)`.

## What `executing_the_agent` does

1. Requires `this.workspace`, `this.prompt`, and `this.agent`
2. Calls `this.agent.run(...)` with `this.image`:
   - Cursor: `docker run` with credentials-only mount + `agent -p --force --output-format json [--model …] -- <prompt>`
   - Claude: `docker run` with the workspace mount and credentials forwarded by env **name** (the value never appears on the host command line) or a read-only `.credentials.json` mount + `claude -p --output-format json --dangerously-skip-permissions [--model …] -- <prompt>`
3. Sets `this.agentResult` to the parsed JSON

## Exports

| Export                                             | Role                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `AgentContext`                                     | Extensible context type (`workspace`, `prompt`, `agent`, `image`, …)                        |
| `agent(opts)`                                      | `withAspect` before — `{ name: "cursor" \| "claude", model?, image? }`                      |
| `buildAgentImage(name)`                            | Suite setup — builds base + agent image (use in vitest `globalSetup`)                       |
| `buildBaseImage()`                                 | Builds `agent-gwt/base:local` only                                                          |
| `buildDockerImage(...)`                            | Builds an arbitrary Dockerfile (e.g. toolchain overlay)                                     |
| `a_workspace`                                      | Creates `/tmp/.agents-gwt/ws-*` (use in `withAspect` before, or in `given`)                 |
| `copy_to_workspace(workspace, globs, options?)`    | Copy glob-matched files into `workspace` from the current spec directory (`from`, `base`)   |
| `cleanup_workspace`                                | Remove the temp workspace (use in `withAspect` after)                                       |
| `the_prompt(text)`                                 | Curried `given` — sets `this.prompt`                                                        |
| `executing_the_agent`                              | `when` — runs `this.agent.run(...)`                                                         |
| `ClaudeAgentResult`                                | Type for Claude Code's JSON result (`is_error`, `result`, `num_turns`, `total_cost_usd`, …) |
| `ClaudeCredentials` / `resolveClaudeCredentials()` | Credential source for the Claude container (token, API key, or file)                        |

## Isolation notes

- **Credentials only:** settings, MCP config, projects, and skills from `~/.cursor` are not mounted. Likewise nothing from `~/.claude` (settings, MCP servers, plugins, skills, projects, hooks) reaches the Claude container, and its auto-updater, telemetry, and error reporting are disabled in the image.
- **Non-root:** the container process uses your host uid/gid so workspace files are owned by you.
- **Workspace is the only writable host path.** A `CLAUDE.md` seeded into the workspace is honoured, because Claude Code reads it from the working directory.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for PR prereleases, architecture, and how to add agents. Publishing details live in [PUBLISHING.md](PUBLISHING.md).
