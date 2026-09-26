# clanker-cleanroom/devin
FROM clanker-cleanroom/base

# Official Devin CLI installer; relocate the binary to a world-readable path so
# arbitrary host UIDs (docker --user) can run devin. Telemetry/self-update are
# disabled for deterministic cleanroom runs.
RUN curl -fsSL https://cli.devin.ai/install.sh | bash \
  && BIN="$(find /root/.local /root/.devin -type f -name devin 2>/dev/null | head -1)" \
  && test -n "$BIN" \
  && install -m 0755 "$BIN" /usr/local/bin/devin \
  && rm -rf /root/.local/share/devin /root/.devin \
  && devin --version

# Empty home for arbitrary host UIDs. ~/.local/share/devin is pre-created so a
# read-only credentials.toml bind mount does not leave the directory root-owned.
RUN mkdir -p /home/agent/.local/share/devin \
  && chmod -R 0777 /home/agent

ENV HOME=/home/agent
ENV PATH="/usr/local/bin:${PATH}"

WORKDIR /workspace

# Runtime identity is set via --user <host-uid>:<host-gid>.
# Credentials arrive as env (DEVIN_API_KEY) or a read-only
# ~/.local/share/devin/credentials.toml mount.
# No ENTRYPOINT — the library passes `devin ...` as the container command.
