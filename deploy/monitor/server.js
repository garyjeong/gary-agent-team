const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { getAgentsList } = require('./lib/config');
const { getAllSessions, getSessionsByAgent, getSessionsForAgent } = require('./lib/sessions');
const { getAgentStatus, getLastActivity, sumTokenUsage, isOpenClawRunning } = require('./lib/status');
const { getRecentLogs } = require('./lib/logs');
const { startWatching } = require('./lib/watcher');

const path = require('path');

const PORT = process.env.MONITOR_PORT || 3001;
const DASHBOARD_DIR = process.env.DASHBOARD_DIR || path.join(__dirname, 'public');
const startedAt = Date.now();

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------------------------------------------------
// GET /api/agents
// Returns agent list with merged session data and computed status.
// -------------------------------------------------------------------
app.get('/api/agents', (req, res) => {
  try {
    const agents = getAgentsList();
    const sessionsByAgent = getSessionsByAgent();

    const result = agents.map((agent) => {
      const sessions = sessionsByAgent[agent.id] || [];
      const status = getAgentStatus(sessions, agent.id);
      const lastActivity = getLastActivity(sessions);
      const tokenUsage = sumTokenUsage(sessions);
      const contextTokens = sessions.reduce((sum, s) => sum + (s.contextTokens || 0), 0);
      const modelStr = agent.model
        ? (typeof agent.model === 'object' ? agent.model.primary : agent.model)
        : null;

      return {
        id: agent.id,
        name: agent.name,
        model: modelStr,
        status,
        lastActivity,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        contextTokens,
        sessionCount: sessions.length,
      };
    });

    // Include agents that have sessions but are not in the config
    const configuredIds = new Set(agents.map((a) => a.id));
    for (const [agentId, sessions] of Object.entries(sessionsByAgent)) {
      if (configuredIds.has(agentId)) continue;

      const status = getAgentStatus(sessions, agentId);
      const lastActivity = getLastActivity(sessions);
      const tokenUsage = sumTokenUsage(sessions);
      const contextTokens = sessions.reduce((sum, s) => sum + (s.contextTokens || 0), 0);

      result.push({
        id: agentId,
        name: agentId,
        model: null,
        status,
        lastActivity,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        contextTokens,
        sessionCount: sessions.length,
      });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[/api/agents] Error:', err.message);
    res.json({ success: true, data: [] });
  }
});

// -------------------------------------------------------------------
// GET /api/sessions
// Returns all session data across all agents.
// -------------------------------------------------------------------
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = getAllSessions();
    res.json({ success: true, data: sessions });
  } catch (err) {
    console.error('[/api/sessions] Error:', err.message);
    res.json({ success: true, data: [] });
  }
});

// -------------------------------------------------------------------
// GET /api/sessions/:agentId
// Returns sessions for a specific agent.
// -------------------------------------------------------------------
app.get('/api/sessions/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const sessions = getSessionsForAgent(agentId);
    res.json({ success: true, data: sessions });
  } catch (err) {
    console.error(`[/api/sessions/${req.params.agentId}] Error:`, err.message);
    res.json({ success: true, data: [] });
  }
});

// -------------------------------------------------------------------
// GET /api/stats
// Returns aggregate statistics.
// -------------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  try {
    const agents = getAgentsList();
    const sessionsByAgent = getSessionsByAgent();
    const allSessions = getAllSessions();

    // Count unique agent IDs from both config and sessions
    const allAgentIds = new Set([
      ...agents.map((a) => a.id),
      ...Object.keys(sessionsByAgent),
    ]);

    let activeCount = 0;
    let idleCount = 0;
    for (const agentId of allAgentIds) {
      const sessions = sessionsByAgent[agentId] || [];
      const status = getAgentStatus(sessions, agentId);
      if (status === 'active') activeCount++;
      else if (status === 'idle') idleCount++;
    }

    const tokenUsage = sumTokenUsage(allSessions);

    res.json({
      success: true,
      data: {
        totalAgents: allAgentIds.size,
        activeAgents: activeCount,
        idleAgents: idleCount,
        totalSessions: allSessions.length,
        totalInputTokens: tokenUsage.inputTokens,
        totalOutputTokens: tokenUsage.outputTokens,
        uptimeMs: Date.now() - startedAt,
        startedAt,
      },
    });
  } catch (err) {
    console.error('[/api/stats] Error:', err.message);
    res.json({
      success: true,
      data: {
        totalAgents: 0,
        activeAgents: 0,
        idleAgents: 0,
        totalSessions: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        uptimeMs: Date.now() - startedAt,
        startedAt,
      },
    });
  }
});

// -------------------------------------------------------------------
// GET /api/logs
// Returns recent log entries from OpenClaw log files.
// Query param: ?lines=50 (default 50)
// -------------------------------------------------------------------
app.get('/api/logs', (req, res) => {
  try {
    const numLines = parseInt(req.query.lines, 10) || 50;
    const logs = getRecentLogs(numLines);
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[/api/logs] Error:', err.message);
    res.json({ success: true, data: { file: null, lines: [], totalLines: 0 } });
  }
});

// -------------------------------------------------------------------
// POST /api/chat
// Sends a message to the PM agent via OpenClaw CLI and returns the reply.
// Uses: openclaw agent --agent pm --message "..." --json --session-id "..."
// -------------------------------------------------------------------
const { execFile } = require('child_process');

app.post('/api/chat', (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  const args = [
    'openclaw.mjs', 'agent',
    '--agent', 'pm',
    '--message', message,
    '--json',
  ];
  if (sessionId) {
    args.push('--session-id', sessionId);
  }

  console.log(`[/api/chat] Sending message to PM agent (session: ${sessionId || 'new'})`);

  execFile('node', args, {
    cwd: '/app',
    timeout: 600_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, HOME: '/home/node' },
  }, (err, stdout, stderr) => {
    if (err) {
      console.error('[/api/chat] CLI error:', err.message);
      if (stderr) console.error('[/api/chat] stderr:', stderr.substring(0, 500));
      if (stdout) console.error('[/api/chat] stdout (on error):', stdout.substring(0, 500));
      return res.status(500).json({
        success: false,
        error: 'Agent did not respond',
        detail: (err.message || '').substring(0, 200),
      });
    }

    console.log(`[/api/chat] stdout: ${stdout.length}b, stderr: ${stderr.length}b`);

    // Extract agent reply from the JSON output
    function extractReply(raw) {
      // Strip ANSI escape codes
      const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').trim();

      // 1. Try direct JSON.parse (--json outputs clean JSON to stdout)
      try {
        const data = JSON.parse(clean);
        // Handle nested result.payloads structure
        const payloads = data.payloads || data.result?.payloads;
        const meta = data.meta || data.result?.meta;
        if (payloads) {
          const texts = payloads.map((p) => p.text).filter(Boolean);
          return { content: texts.join('\n'), sessionId: meta?.agentMeta?.sessionId };
        }
        return { content: data.reply || data.text || data.message || data.content || '' };
      } catch {}

      // 2. Try finding JSON in multi-line output (with debug lines before JSON)
      const lines = clean.split('\n');
      const jsonStart = lines.findIndex((l) => l.trim().startsWith('{'));
      if (jsonStart >= 0) {
        const jsonStr = lines.slice(jsonStart).join('\n');
        try {
          const data = JSON.parse(jsonStr);
          const payloads = data.payloads || data.result?.payloads;
          const meta = data.meta || data.result?.meta;
          if (payloads) {
            const texts = payloads.map((p) => p.text).filter(Boolean);
            return { content: texts.join('\n'), sessionId: meta?.agentMeta?.sessionId };
          }
          return { content: data.reply || data.text || data.message || '' };
        } catch {}
      }

      // 3. Return non-debug lines as plain text
      const textLines = lines.filter((l) => !l.startsWith('[') && l.trim());
      return { content: textLines.join('\n') };
    }

    const result = extractReply(stdout) || extractReply(stderr) || {};
    const content = result.content || '';

    if (content) {
      console.log(`[/api/chat] Reply: ${content.substring(0, 100)}...`);
      res.json({ success: true, data: { content, sessionId: result.sessionId || null } });
    } else {
      console.error('[/api/chat] Empty reply. stdout preview:', JSON.stringify(stdout.substring(0, 300)));
      res.status(500).json({ success: false, error: 'Empty response from agent' });
    }
  });
});

// -------------------------------------------------------------------
// GET /api/health
// Returns server and OpenClaw process health.
// -------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  try {
    const openclawRunning = isOpenClawRunning();

    res.json({
      success: true,
      data: {
        status: 'healthy',
        openclaw: openclawRunning ? 'running' : 'not detected',
        uptime: Date.now() - startedAt,
        startedAt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[/api/health] Error:', err.message);
    res.status(500).json({
      success: false,
      data: {
        status: 'error',
        error: err.message,
      },
    });
  }
});

// -------------------------------------------------------------------
// Serve dashboard static files (built Next.js export)
// -------------------------------------------------------------------
const fs = require('fs');
if (fs.existsSync(DASHBOARD_DIR)) {
  app.use(express.static(DASHBOARD_DIR));
  // SPA fallback: serve index.html for non-API routes
  app.get('*', (req, res) => {
    const indexPath = path.join(DASHBOARD_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ success: false, error: 'Dashboard not found' });
    }
  });
} else {
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not found',
      availableEndpoints: [
        'GET /api/agents',
        'GET /api/sessions',
        'GET /api/sessions/:agentId',
        'GET /api/stats',
        'GET /api/logs',
        'GET /api/health',
        'WS  /ws',
      ],
    });
  });
}

// -------------------------------------------------------------------
// Create HTTP server and attach WebSocket
// -------------------------------------------------------------------
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

// Track connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[ws] Client connected (total: ${clients.size})`);

  // Send initial state on connect
  try {
    const agents = getAgentsList();
    const sessionsByAgent = getSessionsByAgent();
    const agentData = agents.map((agent) => {
      const sessions = sessionsByAgent[agent.id] || [];
      return {
        id: agent.id,
        name: agent.name,
        status: getAgentStatus(sessions, agent.id),
        lastActivity: getLastActivity(sessions),
      };
    });

    ws.send(JSON.stringify({
      type: 'init',
      data: { agents: agentData },
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.error('[ws] Error sending init:', err.message);
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[ws] Client disconnected (total: ${clients.size})`);
  });

  ws.on('error', (err) => {
    console.error('[ws] Client error:', err.message);
    clients.delete(ws);
  });
});

// Broadcast event to all connected WebSocket clients
function broadcast(event) {
  const message = JSON.stringify(event);
  for (const client of clients) {
    try {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
      }
    } catch {
      // ignore individual send errors
    }
  }
}

// Start file watchers and pipe events to WebSocket clients
startWatching((event) => {
  if (clients.size > 0) {
    broadcast(event);
  }
});

// -------------------------------------------------------------------
// Start server
// -------------------------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[monitor] OpenClaw Monitor API running on port ${PORT}`);
  console.log(`[monitor] WebSocket available at ws://0.0.0.0:${PORT}/ws`);
});
