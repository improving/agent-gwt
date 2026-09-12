# Publishing

CI publishes via [npm trusted publishers](https://docs.npmjs.com/trusted-publishers) (OIDC) from [`.github/workflows/publish.yml`](.github/workflows/publish.yml). There is no `NPM_TOKEN` secret.

This repo is a pnpm workspace with four publishable packages:

| Package                     | Path                                                                       |
| --------------------------- | -------------------------------------------------------------------------- |
| `clanker-cleanroom`         | [`packages/clanker-cleanroom`](packages/clanker-cleanroom)                 |
| `@clanker-cleanroom/cursor` | [`packages/clanker-cleanroom-cursor`](packages/clanker-cleanroom-cursor)   |
| `@clanker-cleanroom/claude` | [`packages/clanker-cleanroom-claude`](packages/clanker-cleanroom-claude)   |
| `agent-gwt`                 | [`packages/agent-gwt`](packages/agent-gwt)                                 |

**Versions stay in sync** across five `package.json` files:

1. Root [`package.json`](package.json) (canonical for CI bumps)
2. [`packages/agent-gwt/package.json`](packages/agent-gwt/package.json)
3. [`packages/clanker-cleanroom/package.json`](packages/clanker-cleanroom/package.json)
4. [`packages/clanker-cleanroom-cursor/package.json`](packages/clanker-cleanroom-cursor/package.json)
5. [`packages/clanker-cleanroom-claude/package.json`](packages/clanker-cleanroom-claude/package.json)

CI publishes in dependency order: `clanker-cleanroom` → agent packages → `agent-gwt`.

## One-time setup

### 1. Bootstrap each package on npm

Staged publishing and OIDC trusted publishers require the package name to already exist. From a clean build, publish each package once (manually or with a temporary token), **`clanker-cleanroom` first**:

```bash
pnpm install
pnpm run lint && pnpm run test && pnpm run build
pnpm --filter clanker-cleanroom publish --access public --ignore-scripts
pnpm --filter @clanker-cleanroom/cursor publish --access public --ignore-scripts
pnpm --filter @clanker-cleanroom/claude publish --access public --ignore-scripts
pnpm --filter agent-gwt publish --access public --ignore-scripts
```

### 2. Configure the trusted publisher (each package)

On [npmjs.com](https://www.npmjs.com) → package → Settings → Trusted Publisher, for **each** of the four packages:

| Field                | Value                                               |
| -------------------- | --------------------------------------------------- |
| Provider             | GitHub Actions                                      |
| Organization or user | `improving`                                         |
| Repository           | `agent-gwt`                                         |
| Workflow filename    | `publish.yml`                                       |
| Environment name     | _(leave empty unless you add a GitHub Environment)_ |
| Allowed actions      | **both** `npm publish` and `npm stage publish`      |

Filename must match exactly (including `.yml`). Only one trusted publisher workflow is allowed per package — that is why PR prereleases and merge staging share `publish.yml`.

### 3. Optional: disallow tokens

After OIDC works, under Publishing access prefer requiring 2FA and disallowing classic tokens so only trusted publishing can write.

### 4. Allow Actions to push version bumps

The release job commits `chore: release vX.Y.Z` to `main` with `GITHUB_TOKEN` (those pushes do not re-trigger workflows). If branch protection blocks the bot, add a ruleset bypass for `github-actions[bot]` / allow GitHub Actions to push.

## How it works

| Event                             | What happens                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| PR open/sync/label against `main` | Build → set all package versions → publish **all** packages under `--tag pr-<n>` as `<next>-build.<run>`                |
| PR merged to `main`               | `npm pack` each `@pr-<n>` → rewrite version → `pnpm stage publish` each → bump all `package.json` files on `main`       |
| Maintainer                        | `pnpm stage approve <id>` (2FA) or Approve on npmjs.com **for each staged package**                                     |

### Version labels

| Label    | Bump from root `package.json` on `main` |
| -------- | --------------------------------------- |
| _(none)_ | patch                                   |
| `minor`  | minor                                   |
| `major`  | major                                   |

If both `major` and `minor` are present, `major` wins. The release version is recomputed from `main` at merge time so concurrent PRs stay monotonic. Root + all workspace packages are set to that same version.

## Approving a staged release

Each package gets its own stage id (see the workflow job summary):

```bash
pnpm stage list
pnpm stage view <stage-id>
pnpm stage approve <stage-id>   # once per package
```

Or use the Staged Packages UI on npmjs.com. Approve/reject require interactive 2FA and cannot use OIDC.

## Install prereleases

```bash
pnpm add -D clanker-cleanroom@pr-123 @clanker-cleanroom/cursor@pr-123 agent-gwt@pr-123
```

After a newer build is published to the same tag:

```bash
pnpm update clanker-cleanroom@pr-123 @clanker-cleanroom/cursor@pr-123 agent-gwt@pr-123
```
