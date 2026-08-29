# Contributing

## PR builds

Open PRs against `main` publish a prerelease under the dist-tag `pr-<number>`:

```bash
pnpm add -D agent-gwt@pr-123
```

## Releasing

Merging a PR stages the exact prerelease bits as the next semver (not live until approved):

```bash
pnpm stage list
pnpm stage approve <stage-id>
```

Bump size is controlled by PR labels (`major` > `minor` > patch default). See [Publishing](PUBLISHING.md) for trusted-publisher setup.

## Architecture

| Layer             | Role                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `given` / `when`  | Agent-agnostic GWT DSL (no imports of `agents/<name>`)                                 |
| `agents/registry` | Maps agent names → `Agent`                                                             |
| `agents/`         | Shared `createAgent`, Docker invoke, image ensure/build                                |
| `agents/cursor/`  | Cursor bindings only (Dockerfile path, image, auth, CLI run)                           |
| `package-root`    | Relative resolve to this package’s root (`src/` or `lib/` parent) — no directory scans |

Additional agents (Devin, Claude, Copilot, …) plug in as new folders under `agents/` plus a registry entry.
