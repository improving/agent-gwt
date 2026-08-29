# agent-gwt

GWT step functions for repeatable **agent** tests. Works with [vitest-gwt](https://github.com/devzeebo/vitest-gwt) / [gwt-runner](https://github.com/devzeebo/gwt-runner).

Agent-specific Docker/CLI details live under `src/agents/<name>/`. Shared container plumbing (`runDocker`, `ensureDockerImage`, JSON parse) lives in `src/agents/`. GWT steps (`given` / `when`) stay at the package root and talk to an `Agent` resolved by name.

v1 ships the **Cursor** agent: create a temp workspace, mount **only** Cursor credentials, run the agent as your host user, and put parsed `--output-format json` on the test context.

## Install

```bash
pnpm add -D agent-gwt vitest vitest-gwt
```

## Prerequisites

1. Docker
2. Host Cursor CLI login (`agent login`) so `~/.config/cursor/auth.json` exists
3. A Docker image for the agent (or let `agent(...)` ensure it by building from `node_modules/agent-gwt/docker/cursor/Dockerfile`):

```bash
# optional manual build from this repo; consumers get the same Dockerfile via the published package
pnpm run docker:build
# docker build -t agent-gwt/cursor-cli:local -f docker/cursor/Dockerfile .
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

## What `agent` does

Suite-level `withAspect` **before** hook that:

1. Resolves `name` via the agents registry and sets `this.agent`
2. Sets `this.model` on the aspect context when provided; sets `this.image` from the resolved agent
3. Ensures the Docker image exists once (`docker image inspect`, then `docker build` from the Dockerfile shipped inside the installed `agent-gwt` package under `node_modules`, not from your app root)

Workspace teardown stays separate via `cleanup_workspace` in the aspect **after** hook.

## What `executing_the_agent` does

1. Requires `this.workspace`, `this.prompt`, and `this.agent`
2. Calls `this.agent.run(...)` (Cursor: `docker run` with credentials-only mount + `agent -p --force --output-format json`)
3. Sets `this.agentResult` to the parsed JSON

## Architecture

| Layer | Role |
| ----- | ---- |
| `given` / `when` | Agent-agnostic GWT DSL (no imports of `agents/<name>`) |
| `agents/registry` | Maps agent names → `Agent` |
| `agents/` | Shared `createAgent`, Docker invoke, image ensure |
| `agents/cursor/` | Cursor bindings only (Dockerfile path, image, auth, CLI run) |
| `package-root` | Relative resolve to this package’s root (`src/` or `lib/` parent) — no directory scans |

Additional agents (Devin, Claude, Copilot, …) plug in as new folders under `agents/` plus a registry entry.

## Exports

| Export                | Role                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| `AgentContext`        | Extensible context type (`workspace`, `prompt`, `agent`, `image`, …)    |
| `agent(opts)`         | `withAspect` before — `{ name, model? }` (image comes from the agent) |
| `a_workspace`         | `given` — creates `/tmp/.agents-gwt/ws-*`                               |
| `cleanup_workspace`   | Remove the temp workspace (use in `withAspect` afterEach)               |
| `the_prompt(text)`    | Curried `given` — sets `this.prompt`                                    |
| `executing_the_agent` | `when` — runs `this.agent.run(...)`                                     |

## Isolation notes

- **Credentials only:** settings, MCP config, projects, and skills from `~/.cursor` are not mounted.
- **Non-root:** the container process uses your host uid/gid so workspace files are owned by you.
