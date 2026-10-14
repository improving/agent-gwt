# agent-gwt workspace

pnpm monorepo:

| Package                                                                                 | Role                                                                 |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`clanker-cleanroom`](packages/clanker-cleanroom)                                       | Build/run agent Docker images with workspace bindings                |
| [`@clanker-cleanroom/cursor`](packages/clanker-cleanroom-cursor)                        | Cursor binding + Docker image                                        |
| [`@clanker-cleanroom/claude`](packages/clanker-cleanroom-claude)                        | Claude Code binding + Docker image                                   |
| [`@clanker-cleanroom/plugin-agentfield`](packages/clanker-cleanroom-plugin-agentfield) | `agent.clanker()` bridge into `@agentfield/sdk` with usage auditing  |
| [`agent-gwt`](packages/agent-gwt)                                                       | GWT step functions for repeatable agent tests                        |

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
```

See [packages/clanker-cleanroom/README.md](packages/clanker-cleanroom/README.md), [packages/clanker-cleanroom-plugin-agentfield/README.md](packages/clanker-cleanroom-plugin-agentfield/README.md), and [packages/agent-gwt/README.md](packages/agent-gwt/README.md) for usage.
