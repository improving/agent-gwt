# agent-gwt

GWT step functions for repeatable **agent** tests. Works with [vitest-gwt](https://github.com/devzeebo/vitest-gwt) / [gwt-runner](https://github.com/devzeebo/gwt-runner).

v1 ships the **Cursor** agent: create a temp workspace, mount **only** Cursor credentials, run the agent as your host user, and put parsed `--output-format json` on the test context.

## Install

```bash
pnpm add -D agent-gwt vitest vitest-gwt
```

## Prerequisites

1. Docker
2. Host Cursor CLI login (`agent login`) so `~/.config/cursor/auth.json` exists
3. Build the agent Docker image **once per suite** via vitest `globalSetup` (or manually)

## Setup

Build images once in `globalSetup` so parallel test files do not race:

```ts
// vitest.global-setup.ts
import { buildAgentImage } from "agent-gwt";

export default async function setup() {
  await buildAgentImage("cursor");
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

## Docker images

| Image | Role |
| --- | --- |
| `agent-gwt/base:local` | Shared Arch Linux base (`yay` + `aur` user). Used by all agents. |
| `agent-gwt/cursor-cli:local` | Cursor CLI on top of the base |

`buildAgentImage("cursor")` builds the base first, then the Cursor image.

### Extending with toolchains

Install packages in a child image, then point tests at that tag:

```dockerfile
# docker/agent.Dockerfile
FROM agent-gwt/cursor-cli:local

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
2. Calls `this.agent.run(...)` with `this.image` (Cursor: `docker run` with credentials-only mount + `agent -p --force --output-format json`)
3. Sets `this.agentResult` to the parsed JSON

## Exports

| Export | Role |
| --- | --- |
| `AgentContext` | Extensible context type (`workspace`, `prompt`, `agent`, `image`, …) |
| `agent(opts)` | `withAspect` before — `{ name, model?, image? }` |
| `buildAgentImage(name)` | Suite setup — builds base + agent image (use in vitest `globalSetup`) |
| `buildBaseImage()` | Builds `agent-gwt/base:local` only |
| `buildDockerImage(...)` | Builds an arbitrary Dockerfile (e.g. toolchain overlay) |
| `a_workspace` | Creates `/tmp/.agents-gwt/ws-*` (use in `withAspect` before, or in `given`) |
| `cleanup_workspace` | Remove the temp workspace (use in `withAspect` after) |
| `the_prompt(text)` | Curried `given` — sets `this.prompt` |
| `executing_the_agent` | `when` — runs `this.agent.run(...)` |

## Isolation notes

- **Credentials only:** settings, MCP config, projects, and skills from `~/.cursor` are not mounted.
- **Non-root:** the container process uses your host uid/gid so workspace files are owned by you.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for PR prereleases, architecture, and how to add agents. Publishing details live in [PUBLISHING.md](PUBLISHING.md).
