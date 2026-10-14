# @clanker-cleanroom/plugin-agentfield

Monkeypatches `@agentfield/sdk` `Agent` with `agent.clanker(prompt, options)` so cleanroom coding agents run inside AgentField reasoners and record harness-style usage into the control-plane audit rollup.

## Install

```bash
pnpm add @clanker-cleanroom/plugin-agentfield clanker-cleanroom @agentfield/sdk
# plus the agent(s) you use:
pnpm add @clanker-cleanroom/cursor   # and/or @clanker-cleanroom/claude
```

## Usage

```ts
import { Agent } from "@agentfield/sdk";
import "@clanker-cleanroom/cursor/register";
import "@clanker-cleanroom/plugin-agentfield/register";

const agent = new Agent({
  nodeId: "fixer",
  aiConfig: { provider: "openai", model: "gpt-4o" },
});

agent.reasoner("fix", async () => {
  const result = await agent.clanker("Fix the failing test and leave a short summary", {
    agent: "cursor",
    workspace: "/tmp/ws",
    model: "auto",
  });

  return { summary: result.text, costUsd: result.costUsd };
});
```

Or call `installClanker()` / the free `clanker(prompt, options, deps?)` helper from the package root instead of the `/register` side-effect.

Optional third argument `deps` is forwarded the same way on both `agent.clanker` and free `clanker` — pass `{ createAgent }` to reuse a staged cleanroom `Agent` (for `/agent/input` + `/agent/output`).

## Options

| Field | Type | Required | Role |
| --- | --- | --- | --- |
| `agent` | `string` | yes | Stock name (`cursor`, `claude`) or registry tag (`cursor:node`) |
| `workspace` | `string` | yes | Host workspace mounted at `/workspace` |
| `model` | `string` | no | Forwarded to the cleanroom agent |
| `image` | `string` | no | Docker image override |
| `remaps` | `Remaps` | no | Nested DooD path remaps |
| `signal` | `AbortSignal` | no | Cancel the in-flight run |
| `schema` | Zod / `{ parse }` | no | Structured output via `.agentfield_output.json` in the workspace |

Returns an AgentField `HarnessResult`. Token/cost usage is recorded on the current execution's `CostTracker` with `source: "harness"` and `harness: "clanker_<agent>"` when an execution context is active.

## Prerequisites

1. Docker (same as `clanker-cleanroom`)
2. Built/registered cleanroom images and bindings for the agents you call
3. Host credentials for those agents
