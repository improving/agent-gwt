# @clanker-cleanroom/devin

Devin CLI agent binding for [clanker-cleanroom](../clanker-cleanroom). Runs the
Devin CLI inside a Docker container and parses its
[ATIF](https://github.com/harbor-framework/harbor/blob/main/rfcs/0001-trajectory-format.md)
export (Agent Trajectory Interchange Format) instead of stdout.

## Usage

```ts
import "@clanker-cleanroom/devin/register";
import { Agent } from "clanker-cleanroom";

const agent = new Agent("devin");
const result = await agent.run({ workspace: "/path/to/repo", prompt: "Fix the tests" });
```

## Authentication

One of (in order):

1. `DEVIN_API_KEY` env var — forwarded to the container by name, never on argv.
2. Host `~/.local/share/devin/credentials.toml` (written by `devin auth login`) —
   bind-mounted read-only.

## How it differs from the other agents

Claude Code and Cursor stream NDJSON to stdout, which the shared runner redirects
to `/agent/output/trajectory`. Devin instead writes its trajectory as a single
ATIF JSON document via `--export <path>`, so this binding points `--export` at
that same path and discards stdout (the runner's stdout redirect would otherwise
clobber the export file). `parseResult` reads the ATIF document's
`final_metrics` (falling back to summing per-step metrics), and `adaptEvents`
flattens ATIF `steps` into normalized trajectory events.

## Docker image

`docker/devin.Dockerfile` builds `clanker-cleanroom/devin` on the shared
`clanker-cleanroom/base` image. Build it with `buildImages({ dir: DOCKER_DIR })`
from this package, or via the `agent-gwt` e2e globalSetup. A container smoke
test (`src/docker.smoke.spec.ts`) runs `devin --version` and skips cleanly when
Docker is unavailable or the image has not been built.
