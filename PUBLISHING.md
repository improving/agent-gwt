# Publishing

CI publishes via [npm trusted publishers](https://docs.npmjs.com/trusted-publishers) (OIDC) from [`.github/workflows/publish.yml`](.github/workflows/publish.yml). There is no `NPM_TOKEN` secret.

## One-time setup

### 1. Bootstrap the package on npm

Staged publishing requires the package to already exist. From a clean build, publish the initial version once (manually or with a temporary token):

```bash
pnpm install
pnpm run lint && pnpm run test && pnpm run build
pnpm publish --access public --ignore-scripts
```

### 2. Configure the trusted publisher

On [npmjs.com](https://www.npmjs.com) → `agent-gwt` → Settings → Trusted Publisher:

| Field | Value |
| ----- | ----- |
| Provider | GitHub Actions |
| Organization or user | `improving` |
| Repository | `agent-gwt` |
| Workflow filename | `publish.yml` |
| Environment name | _(leave empty unless you add a GitHub Environment)_ |
| Allowed actions | **both** `npm publish` and `npm stage publish` |

Filename must match exactly (including `.yml`). Only one trusted publisher workflow is allowed per package — that is why PR prereleases and merge staging share `publish.yml`.

### 3. Optional: disallow tokens

After OIDC works, under Publishing access prefer requiring 2FA and disallowing classic tokens so only trusted publishing can write.

### 4. Allow Actions to push version bumps

The release job commits `chore: release vX.Y.Z` to `main` with `GITHUB_TOKEN` (those pushes do not re-trigger workflows). If branch protection blocks the bot, add a ruleset bypass for `github-actions[bot]` / allow GitHub Actions to push.

## How it works

| Event | What happens |
| ----- | ------------ |
| PR open/sync/label against `main` | Build → `pnpm publish --tag pr-<n>` as `<next>-build.<run>` |
| PR merged to `main` | `npm pack agent-gwt@pr-<n>` → rewrite version → `pnpm stage publish` → bump `package.json` on `main` |
| Maintainer | `pnpm stage approve <id>` (2FA) or Approve on npmjs.com |

### Version labels

| Label | Bump from `main`'s `package.json` |
| ----- | ---------------------------------- |
| _(none)_ | patch |
| `minor` | minor |
| `major` | major |

If both `major` and `minor` are present, `major` wins. The release version is recomputed from `main` at merge time so concurrent PRs stay monotonic.

## Approving a staged release

```bash
pnpm stage list
pnpm stage view <stage-id>
pnpm stage approve <stage-id>
```

Or use the Staged Packages UI on npmjs.com. Approve/reject require interactive 2FA and cannot use OIDC.
