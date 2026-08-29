# Claude Code agent image. Shared Arch/yay base is agent-gwt/base:local.
# Extend with toolchains: FROM agent-gwt/claude-code:local
FROM agent-gwt/base:local

# Never self-update or phone home from inside the container — build steps included.
ENV DISABLE_AUTOUPDATER=1
ENV DISABLE_TELEMETRY=1
ENV DISABLE_ERROR_REPORTING=1

# Official native installer drops a single self-contained binary under
# ~/.local/share/claude/versions/<version>. Relocate it to a world-readable
# path so arbitrary host UIDs (docker --user) can run claude.
RUN curl -fsSL https://claude.ai/install.sh | bash \
  && VERSION_BIN="$(find /root/.local/share/claude/versions -mindepth 1 -maxdepth 1 -type f | sort -V | tail -1)" \
  && test -n "$VERSION_BIN" \
  && install -m 0755 "$VERSION_BIN" /usr/local/bin/claude \
  && rm -rf /root/.local/share/claude /root/.local/bin/claude \
  && claude --version

# Empty home for arbitrary host UIDs. ~/.claude is pre-created so a read-only
# .credentials.json bind mount does not leave the directory root-owned.
RUN mkdir -p /home/agent/.claude \
  && chmod -R 0777 /home/agent

ENV HOME=/home/agent
ENV PATH="/usr/local/bin:${PATH}"

WORKDIR /workspace

# Runtime identity is set by agent-gwt via --user <host-uid>:<host-gid>.
# Credentials arrive as env (CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY) or a
# read-only ~/.claude/.credentials.json mount — see src/agents/claude/run.ts.
# No ENTRYPOINT — the library passes `claude ...` as the container command.
