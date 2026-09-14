# Contributing

## PR builds

Open PRs against `main` publish prereleases under the dist-tag `pr-<number>` for all workspace packages:

```bash
pnpm add -D clanker-cleanroom@pr-123 @clanker-cleanroom/cursor@pr-123 agent-gwt@pr-123
```

pnpm caches aggressively, so after the pipeline publishes a newer build to the same tag, force a re-resolve:

```bash
pnpm update clanker-cleanroom@pr-123 @clanker-cleanroom/cursor@pr-123 agent-gwt@pr-123
```

## Releasing

Merging a PR stages the exact prerelease bits as the next semver (not live until approved):

```bash
pnpm stage list
pnpm stage approve <stage-id>
```

Bump size is controlled by PR labels (`major` > `minor` > patch default). See [Publishing](PUBLISHING.md) for trusted-publisher setup.

## Testing

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run lint
```

`pnpm test` runs unit suites (Docker mocked) across workspace packages. `pnpm run test:e2e` runs `packages/agent-gwt/e2e/` against real agent images. It needs Docker, and each agent's tests run only when that agent's credential is present on the host: Cursor needs `agent login` (`~/.config/cursor/auth.json`), Claude needs `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` in the environment. `globalSetup` builds base + available agent images when any credential is present. On Apple Silicon export `DOCKER_DEFAULT_PLATFORM=linux/amd64` first.

## Architecture

pnpm workspace packages:

| Package                              | Role                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| `packages/clanker-cleanroom`         | Core runtime, base image, pluggable binding registry                |
| `packages/clanker-cleanroom-cursor`  | Cursor binding, Dockerfile, `@clanker-cleanroom/cursor/register`    |
| `packages/clanker-cleanroom-claude`  | Claude binding, Dockerfile, `@clanker-cleanroom/claude/register`    |
| `packages/agent-gwt`                 | GWT steps (`given` / `when`) that call into `clanker-cleanroom`     |

### `clanker-cleanroom`

| Layer                 | Role                                                                              |
| --------------------- | --------------------------------------------------------------------------------- |
| `docker/base.Dockerfile` | Shared base image; first line `# clanker-cleanroom/base`                       |
| `images/`             | Parse folder → DAG → `buildImages` → `clanker-cleanroom.images.json`              |
| `agents/`             | `Agent` class, `runBoundAgent`, registry (`registerBinding`)                     |
| `package-root`        | Resolves installed package root so base Dockerfiles come from `node_modules`      |

Additional agents are separate packages that call `registerBinding` and ship their own `docker/*.Dockerfile`.

### `agent-gwt`

| Layer            | Role                                                         |
| ---------------- | ------------------------------------------------------------ |
| `given` / `when` | Agent-agnostic GWT DSL                                       |
| Re-exports       | Soft-break surface for `buildImages`, `Agent`, docker helpers |
