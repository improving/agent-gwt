# Contributing

## PR builds

Open PRs against `main` publish a prerelease under the dist-tag `pr-<number>`:

```bash
pnpm add -D agent-gwt@pr-123
```

pnpm caches aggressively, so after the pipeline publishes a newer build to the same tag, force a re-resolve:

```bash
pnpm update agent-gwt@pr-123
```

## Releasing

Merging a PR stages the exact prerelease bits as the next semver (not live until approved):

```bash
pnpm stage list
pnpm stage approve <stage-id>
```

Bump size is controlled by PR labels (`major` > `minor` > patch default). See [Publishing](PUBLISHING.md) for trusted-publisher setup.

## Testing

`pnpm test` runs the unit suite with Docker mocked. `pnpm run test:e2e` runs `e2e/` against the real agent images. It needs Docker, and each agent's tests run only when that agent's credential is present on the host: Cursor needs `agent login` (`~/.config/cursor/auth.json`), Claude needs `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` in the environment. `globalSetup` builds the images for the agents that have credentials and the rest skip cleanly. On Apple Silicon export `DOCKER_DEFAULT_PLATFORM=linux/amd64` first.

## Architecture

| Layer             | Role                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `given` / `when`  | Agent-agnostic GWT DSL (no imports of `agents/<name>`)                                 |
| `agents/registry` | Maps agent names → `Agent`                                                             |
| `agents/`         | Shared `createAgent`, Docker invoke, image ensure/build                                |
| `agents/base/`    | Shared Arch base image constants (`agent-gwt/base:local`)                              |
| `agents/cursor/`  | Cursor bindings only (Dockerfile path, image, auth, CLI run)                           |
| `agents/claude/`  | Claude Code bindings only (Dockerfile path, image, credentials, CLI run)             |
| `docker/base/`    | Shared Arch + yay Dockerfile (all agents `FROM` this tag)                              |
| `docker/<agent>/` | Per-agent Dockerfile (`FROM agent-gwt/base:local` + that product’s CLI)                |
| `package-root`    | Relative resolve to this package’s root (`src/` or `lib/` parent) — no directory scans |

Additional agents (Devin, Copilot, …) add `docker/<name>/Dockerfile` on the shared base, a folder under `agents/`, and a registry entry.
