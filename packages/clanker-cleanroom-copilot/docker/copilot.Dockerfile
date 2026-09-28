# clanker-cleanroom/copilot
FROM clanker-cleanroom/base

# Official Copilot CLI installer; running as root installs to /usr/local/bin,
# world-readable so arbitrary host UIDs (docker --user) can run copilot.
RUN curl -fsSL https://gh.io/copilot-install | VERSION=latest bash \
  && chmod -R a+rX /usr/local/bin/copilot \
  && command -v copilot

# Empty home for arbitrary host UIDs; only ~/.copilot is bind-mounted at runtime.
RUN mkdir -p /home/agent/.copilot \
  && chmod -R 0777 /home/agent

ENV HOME=/home/agent
ENV PATH="/usr/local/bin:${PATH}"
# Pin the image: never auto-update inside the container.
ENV COPILOT_AUTO_UPDATE=false

WORKDIR /workspace

# Runtime identity is set via --user <host-uid>:<host-gid>.
# No ENTRYPOINT — the library passes `copilot ...` as the container command.
