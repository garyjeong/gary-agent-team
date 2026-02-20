FROM ghcr.io/openclaw/openclaw:latest

# Switch to root for installations
USER root

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code@latest

# Install gh CLI, git, AWS CLI, fly CLI for GitHub, AWS, and Fly.io operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    gh \
    git \
    awscli \
    curl \
    && curl -L https://fly.io/install.sh | sh \
    && ln -s /root/.fly/bin/flyctl /usr/local/bin/fly \
    && rm -rf /var/lib/apt/lists/*

# Create agent workspace directory
RUN mkdir -p /data/agents/pm/workspace

# Copy agent workspace files
COPY agents/pm/workspace/ /data/agents/pm/workspace/

# Create per-account Claude CLI wrapper scripts (credentials stored on persistent volume /data)
RUN printf '#!/bin/sh\nCLAUDE_CONFIG_DIR=/data/.claude-viewster exec claude "$@"\n' > /usr/local/bin/claude-viewster \
    && printf '#!/bin/sh\nCLAUDE_CONFIG_DIR=/data/.claude-gary exec claude "$@"\n' > /usr/local/bin/claude-gary \
    && chmod +x /usr/local/bin/claude-viewster /usr/local/bin/claude-gary

# Copy OpenClaw config (node user home)
RUN mkdir -p /home/node/.openclaw
COPY config.json5 /home/node/.openclaw/openclaw.json

# Install monitor API server
COPY monitor/ /opt/monitor/
RUN cd /opt/monitor && npm install --production

# Build and copy dashboard frontend (static export)
COPY dashboard-build/ /opt/monitor/public/

RUN chown -R node:node /home/node/.openclaw /data /opt/monitor

# Switch back to node user
USER node

EXPOSE 18789 3001

# Start OpenClaw gateway and monitor API in parallel
CMD node /opt/monitor/server.js & node openclaw.mjs gateway --bind lan --allow-unconfigured
