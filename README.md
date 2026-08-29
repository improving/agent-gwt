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
3. Build the agent Docker image **once per suite** via vitest `globalSetup` (or manually):

```ts
// vitest.global-setup.ts
import { buildAgentImage } from "agent-gwt";

export default async function setup() {
  // Builds agent-gwt/base:local then agent-gwt/cursor-cli:local
  await buildAgentImage("cursor");
}
```

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./vitest.global-setup.ts"],
  },
});
```

## Usage

```ts
import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect } from "vitest";
import test, { withAspect } from "vitest-gwt";
import {
  type AgentContext,
  agent,
  a_workspace,
  cleanup_workspace,
  the_prompt,
  executing_the_agent,
} from "agent-gwt";

type Context = AgentContext & {
  // extend with your own fields
};

describe("cursor agent", () => {
  withAspect(
    agent({
      name: "cursor",
      model: "auto",
    }),
    cleanup_workspace,
  );

  test("creates README from prompt", {
    given: {
      a_workspace,
      the_prompt: the_prompt("Create a README.md that says hello"),
    },
    when: {
      executing_the_agent,
    },
    then: {
      agent_returned_json,
      readme_exists,
    },
  });
});

function agent_returned_json(this: Context) {
  expect(this.agentResult).toEqual(expect.any(Object));
}

async function readme_exists(this: Context) {
  await access(join(this.workspace, "README.md"));
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
agent({ name: "cursor", image: "my-app/agent:local", model: "auto" })
```

The base uses Arch/`pacman` (glibc). Alpine will not run the Cursor CLI.

## What `agent` does

Suite-level `withAspect` **before** hook that:

1. Resolves `name` via the agents registry and sets `this.agent`
2. Sets `this.model` when provided; sets `this.image` from `options.image` or the resolved agent
3. Asserts that Docker image already exists (`docker image inspect`) — it does **not** build. Build once in `globalSetup` with `buildAgentImage(...)` so parallel test files do not race

Workspace teardown stays separate via `cleanup_workspace` in the aspect **after** hook.

## What `executing_the_agent` does

1. Requires `this.workspace`, `this.prompt`, and `this.agent`
2. Calls `this.agent.run(...)` with `this.image` (Cursor: `docker run` with credentials-only mount + `agent -p --force --output-format json`)
3. Sets `this.agentResult` to the parsed JSON

## Exports

| Export                  | Role                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `AgentContext`          | Extensible context type (`workspace`, `prompt`, `agent`, `image`, …)                      |
| `agent(opts)`           | `withAspect` before — `{ name, model?, image? }`                                          |
| `buildAgentImage(name)` | Suite setup — builds base + agent image (use in vitest `globalSetup`)                     |
| `buildBaseImage()`      | Builds `agent-gwt/base:local` only                                                        |
| `buildDockerImage(...)` | Builds an arbitrary Dockerfile (e.g. toolchain overlay)                                   |
| `a_workspace`           | `given` — creates `/tmp/.agents-gwt/ws-*`                                                 |
| `cleanup_workspace`     | Remove the temp workspace (use in `withAspect` afterEach)                                 |
| `the_prompt(text)`      | Curried `given` — sets `this.prompt`                                                      |
| `executing_the_agent`   | `when` — runs `this.agent.run(...)`                                                       |

## Isolation notes

- **Credentials only:** settings, MCP config, projects, and skills from `~/.cursor` are not mounted.
- **Non-root:** the container process uses your host uid/gid so workspace files are owned by you.
