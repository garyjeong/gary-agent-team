const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { getAgentsList } = require('./lib/config');
const { getAllSessions, getSessionsByAgent, getSessionsForAgent } = require('./lib/sessions');
const { getAgentStatus, getLastActivity, sumTokenUsage, isOpenClawRunning } = require('./lib/status');
const { getRecentLogs } = require('./lib/logs');
const { startWatching } = require('./lib/watcher');
const { getEnvironmentInfo } = require('./lib/environment');

const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const PORT = process.env.MONITOR_PORT || 3001;
const DASHBOARD_DIR = process.env.DASHBOARD_DIR || path.join(__dirname, 'public');
const startedAt = Date.now();

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// -------------------------------------------------------------------
// Auth & Security
// -------------------------------------------------------------------
const PASSWORD_HASH = process.env.DASHBOARD_PASSWORD_HASH || '';
const activeSessions = new Set();

function verifyPassword(password) {
  if (!PASSWORD_HASH) return false;
  const [salt, storedHash] = PASSWORD_HASH.split(':');
  if (!salt || !storedHash) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// Search engine blocking
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

// Login page HTML
const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Gary Agent Team</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0f;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
display:flex;align-items:center;justify-content:center;min-height:100dvh}
.card{background:#12121a;border:1px solid rgba(255,255,255,0.06);border-radius:24px;padding:40px;
width:100%;max-width:360px;margin:16px}
h1{font-size:18px;font-weight:700;text-align:center;margin-bottom:4px}
.sub{font-size:12px;color:#6b7280;text-align:center;margin-bottom:28px}
.badge{display:inline-block;background:rgba(99,102,241,0.15);color:#818cf8;font-size:11px;
font-weight:600;padding:2px 10px;border-radius:9999px;margin-left:8px}
input{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);
border-radius:12px;padding:12px 16px;color:#e5e5e5;font-size:14px;outline:none;
transition:border-color .2s,background .2s}
input:focus{border-color:rgba(99,102,241,0.4);background:rgba(255,255,255,0.06);
box-shadow:0 0 0 3px rgba(99,102,241,0.15)}
input::placeholder{color:#6b7280}
button{width:100%;margin-top:12px;padding:12px;background:#4f46e5;color:#fff;font-size:14px;
font-weight:600;border:none;border-radius:12px;cursor:pointer;transition:background .2s}
button:hover{background:#6366f1}
button:disabled{background:#374151;color:#6b7280;cursor:not-allowed}
.error{color:#f87171;font-size:12px;text-align:center;margin-top:12px;min-height:18px}
</style></head><body>
<div class="card">
<h1>Gary Agent Team<span class="badge">Dashboard</span></h1>
<p class="sub">접근이 제한된 페이지입니다</p>
<form id="f">
<input type="password" id="pw" placeholder="비밀번호를 입력하세요" autocomplete="current-password" autofocus>
<button type="submit" id="btn">로그인</button>
<p class="error" id="err"></p>
</form></div>
<script>
const f=document.getElementById('f'),pw=document.getElementById('pw'),
btn=document.getElementById('btn'),err=document.getElementById('err');
f.addEventListener('submit',async e=>{
e.preventDefault();err.textContent='';btn.disabled=true;btn.textContent='확인 중...';
try{const r=await fetch('/api/auth/login',{method:'POST',
headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw.value})});
const d=await r.json();
if(d.success){location.href='/';}
else{err.textContent=d.error||'비밀번호가 틀렸습니다';pw.value='';pw.focus();}
}catch{err.textContent='서버 연결 실패';}
finally{btn.disabled=false;btn.textContent='로그인';}});
</script></body></html>`;

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password || !verifyPassword(password)) {
    return res.status(401).json({ success: false, error: '비밀번호가 틀렸습니다' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.add(token);
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });
  res.json({ success: true });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.auth_token;
  if (token) activeSessions.delete(token);
  res.clearCookie('auth_token');
  res.json({ success: true });
});

// Auth middleware - protect all subsequent routes
app.use((req, res, next) => {
  // Skip auth if no password is configured
  if (!PASSWORD_HASH) return next();
  // Allow auth endpoints and robots.txt
  if (req.path === '/api/auth/login' || req.path === '/robots.txt') return next();

  const token = req.cookies?.auth_token;
  if (token && activeSessions.has(token)) return next();

  // Return login page for HTML requests, 401 for API
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  return res.status(200).type('html').send(LOGIN_PAGE);
});

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
  const { message, sessionId, agentId } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, error: 'message is required' });
  }

  // Validate agentId if provided, default to 'pm'
  const validAgents = new Set(['pm', 'viewster-pm', 'gary-pm']);
  const targetAgent = (agentId && validAgents.has(agentId)) ? agentId : 'pm';

  const args = [
    'openclaw.mjs', 'agent',
    '--agent', targetAgent,
    '--message', message,
    '--json',
  ];
  if (sessionId) {
    args.push('--session-id', sessionId);
  }

  console.log(`[/api/chat] Sending message to ${targetAgent} agent (session: ${sessionId || 'new'})`);

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
      // Agent completed but returned no text (e.g. spawned sub-agents or ran tools)
      console.log('[/api/chat] Empty payloads - agent executed tools without text reply. stdout preview:', JSON.stringify(stdout.substring(0, 300)));
      res.json({ success: true, data: { content: '작업을 처리했어. 텍스트 응답 없이 도구를 실행한 것 같아. 진행 상황을 물어봐줘.', sessionId: result.sessionId || null } });
    }
  });
});

// -------------------------------------------------------------------
// GET /api/usage
// Returns Claude Max rate-limit usage for each CLI backend account.
// Reads OAuth tokens from credential files and calls Anthropic API.
// -------------------------------------------------------------------
const USAGE_CACHE_TTL = 60_000; // 60 seconds
let usageCache = { data: null, timestamp: 0 };

const ACCOUNTS = [
  { id: 'claude-viewster', label: 'Max 20x', credPath: '/data/.claude-viewster/.credentials.json' },
  { id: 'claude-gary', label: 'Max 5x', credPath: '/data/.claude-gary/.credentials.json' },
];

function readOAuthToken(credPath) {
  try {
    if (!fs.existsSync(credPath)) return null;
    const data = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const token = data.claudeAiOauth?.accessToken;
    const expiresAt = data.claudeAiOauth?.expiresAt;
    if (!token) return null;
    if (expiresAt && expiresAt <= Date.now()) return null;
    return token;
  } catch {
    return null;
  }
}

async function fetchAccountUsage(token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      five_hour: data.five_hour || null,
      seven_day: data.seven_day || null,
      seven_day_sonnet: data.seven_day_sonnet || null,
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

app.get('/api/usage', async (req, res) => {
  try {
    const now = Date.now();
    if (usageCache.data && (now - usageCache.timestamp) < USAGE_CACHE_TTL) {
      return res.json({ success: true, data: usageCache.data });
    }

    const results = await Promise.all(
      ACCOUNTS.map(async (account) => {
        const token = readOAuthToken(account.credPath);
        if (!token) return { id: account.id, label: account.label, usage: null, error: 'no token' };
        const usage = await fetchAccountUsage(token);
        return { id: account.id, label: account.label, usage, error: usage ? null : 'api error' };
      })
    );

    usageCache = { data: results, timestamp: now };
    res.json({ success: true, data: results });
  } catch (err) {
    console.error('[/api/usage] Error:', err.message);
    res.json({ success: true, data: [] });
  }
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
// GET /api/environment
// Returns deployed environment info: skills, plugins, agent tools.
// -------------------------------------------------------------------
app.get('/api/environment', (req, res) => {
  try {
    const data = getEnvironmentInfo();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[/api/environment] Error:', err.message);
    res.json({ success: true, data: { plugins: [], skills: [], agentTools: {}, cliBackends: [] } });
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
