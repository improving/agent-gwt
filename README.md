# agent-gwt workspace

pnpm monorepo:

| Package                                           | Role                                                  |
| ------------------------------------------------- | ----------------------------------------------------- |
| [`clanker-cleanroom`](packages/clanker-cleanroom) | Build/run agent Docker images with workspace bindings |
| [`agent-gwt`](packages/agent-gwt)                 | GWT step functions for repeatable agent tests         |

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
```

See [packages/clanker-cleanroom/README.md](packages/clanker-cleanroom/README.md) and [packages/agent-gwt/README.md](packages/agent-gwt/README.md) for usage.
