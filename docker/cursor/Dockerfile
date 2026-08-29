FROM ubuntu:24.04

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    bash \
  && rm -rf /var/lib/apt/lists/*

# Official Cursor CLI installer; copy binaries where any uid can execute them.
RUN curl -fsSL https://cursor.com/install | bash \
  && mkdir -p /usr/local/bin \
  && find /root -type f \( -name 'agent' -o -name 'cursor-agent' \) 2>/dev/null \
    | head -20 \
    | while read -r bin; do cp -f "$bin" "/usr/local/bin/$(basename "$bin")"; done \
  && if [ ! -e /usr/local/bin/agent ] && [ -e /usr/local/bin/cursor-agent ]; then \
       ln -sf /usr/local/bin/cursor-agent /usr/local/bin/agent; \
     fi \
  && chmod a+rx /usr/local/bin/agent /usr/local/bin/cursor-agent 2>/dev/null || true \
  && command -v agent

# Empty home for arbitrary host UIDs; only auth.json is bind-mounted at runtime.
RUN mkdir -p /home/agent/.config/cursor \
  && chmod -R 0777 /home/agent

ENV HOME=/home/agent
ENV PATH="/usr/local/bin:${PATH}"

WORKDIR /workspace

# Runtime identity is set by agent-gwt via --user <host-uid>:<host-gid>.
# No ENTRYPOINT — the library passes `agent ...` as the container command.
