# Contributing

## PR builds

Open PRs against `main` publish prereleases under the dist-tag `pr-<number>` for **both** workspace packages:

```bash
pnpm add -D clanker-cleanroom@pr-123 agent-gwt@pr-123
```

pnpm caches aggressively, so after the pipeline publishes a newer build to the same tag, force a re-resolve:

```bash
pnpm update clanker-cleanroom@pr-123 agent-gwt@pr-123
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

`pnpm test` runs unit suites (Docker mocked) in both workspace packages. `pnpm run test:e2e` runs `packages/agent-gwt/e2e/` against real agent images. It needs Docker, and each agent's tests run only when that agent's credential is present on the host: Cursor needs `agent login` (`~/.config/cursor/auth.json`), Claude needs `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` in the environment. `globalSetup` calls `buildImages()` when any credential is present. On Apple Silicon export `DOCKER_DEFAULT_PLATFORM=linux/amd64` first.

## Architecture

pnpm workspace with two packages:

| Package | Role |
| --- | --- |
| `packages/clanker-cleanroom` | Docker folder-graph builds, image registry JSON, agent run bindings |
| `packages/agent-gwt` | GWT steps (`given` / `when`) that call into `clanker-cleanroom` |

### `clanker-cleanroom`

| Layer | Role |
| --- | --- |
| `docker/*.Dockerfile` | Stock images; first line `# clanker-cleanroom/<name>`, `FROM` local tags for deps |
| `images/` | Parse folder → DAG → `buildImages` → `clanker-cleanroom.images.json` |
| `agents/` | Cursor/Claude run bindings, `createAgent`, `runDocker` |
| `package-root` | Resolves installed package root so stock Dockerfiles come from `node_modules` |

Additional agents add a `*.Dockerfile` (with `# clanker-cleanroom/<name>` + `FROM clanker-cleanroom/base`), a folder under `agents/`, and a registry entry.

### `agent-gwt`

| Layer | Role |
| --- | --- |
| `given` / `when` | Agent-agnostic GWT DSL |
| Re-exports | Soft-break surface for `buildImages`, agents, docker helpers |
