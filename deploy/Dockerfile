FROM ghcr.io/openclaw/openclaw:latest

# Switch to root for installations
USER root

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code@latest

# Install gh CLI, git, AWS CLI, fly CLI, jq for GitHub, AWS, Fly.io operations and config merging
RUN apt-get update && apt-get install -y --no-install-recommends \
    gh \
    git \
    awscli \
    curl \
    jq \
    && curl -L https://fly.io/install.sh | sh \
    && ln -s /root/.fly/bin/flyctl /usr/local/bin/fly \
    && rm -rf /var/lib/apt/lists/*

# Create agent workspace directories
RUN mkdir -p /data/agents/pm/workspace \
    /data/agents/viewster-pm/workspace \
    /data/agents/gary-pm/workspace

# Copy agent workspace files
COPY agents/pm/workspace/ /data/agents/pm/workspace/
COPY agents/viewster-pm/workspace/ /data/agents/viewster-pm/workspace/
COPY agents/gary-pm/workspace/ /data/agents/gary-pm/workspace/

# Create per-account Claude CLI wrapper scripts (credentials stored on persistent volume /data)
RUN printf '#!/bin/sh\nCLAUDE_CONFIG_DIR=/data/.claude-viewster exec claude "$@"\n' > /usr/local/bin/claude-viewster \
    && printf '#!/bin/sh\nCLAUDE_CONFIG_DIR=/data/.claude-gary exec claude "$@"\n' > /usr/local/bin/claude-gary \
    && chmod +x /usr/local/bin/claude-viewster /usr/local/bin/claude-gary

# Patch OpenClaw: remove hardcoded "Tools are disabled" from CLI agent system prompt
# This allows Claude Code CLI backends to use built-in tools (Bash, Read, Write, etc.)
RUN find /app/dist -name '*.js' -exec grep -l 'Tools are disabled in this session' {} \; | \
    xargs -I{} sed -i 's/, "Tools are disabled in this session. Do not call tools."//g' {}

# Copy OpenClaw config (node user home)
RUN mkdir -p /home/node/.openclaw
COPY config.json5 /home/node/.openclaw/openclaw.json

# Install monitor API server
COPY monitor/ /opt/monitor/
RUN cd /opt/monitor && npm install --production

# Build and copy dashboard frontend (static export)
COPY dashboard-build/ /opt/monitor/public/

# Copy Claude Skills & Plugins config staging directory
COPY claude-config/ /opt/claude-config/
COPY setup-claude-config.sh /opt/setup-claude-config.sh
RUN chmod +x /opt/setup-claude-config.sh

RUN chown -R node:node /home/node/.openclaw /data /opt/monitor /opt/claude-config /opt/setup-claude-config.sh

# Switch back to node user
USER node

EXPOSE 18789 3001

# Start: sync Claude config to volume, then launch monitor API + OpenClaw gateway
# Note: semicolons ensure setup completes before services start
CMD /opt/setup-claude-config.sh; node /opt/monitor/server.js & node openclaw.mjs gateway --bind lan --allow-unconfigured
