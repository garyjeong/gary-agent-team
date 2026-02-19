const fs = require('fs');
const path = require('path');

// Directories to scan for session data
const SESSION_DIRS = [
  '/home/node/.openclaw/agents',
  '/data/agents',
];

/**
 * Attempt to read and parse a JSON file. Returns null on any failure.
 */
function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Discover all sessions.json files across known directories.
 * Returns a map of agentId -> { sessionKey -> sessionData }.
 */
function discoverSessionFiles() {
  const results = new Map();

  for (const baseDir of SESSION_DIRS) {
    try {
      if (!fs.existsSync(baseDir)) continue;

      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const agentId = entry.name;

        // Check multiple possible paths for sessions.json
        const candidates = [
          path.join(baseDir, agentId, 'sessions', 'sessions.json'),
          path.join(baseDir, agentId, 'agent', 'sessions', 'sessions.json'),
        ];

        for (const candidate of candidates) {
          const data = readJsonFile(candidate);
          if (data && typeof data === 'object') {
            // Merge into existing agent data (later sources override)
            const existing = results.get(agentId) || {};
            results.set(agentId, { ...existing, ...data });
          }
        }
      }
    } catch (err) {
      console.error(`[sessions] Error scanning ${baseDir}:`, err.message);
    }
  }

  return results;
}

/**
 * Get all sessions as a flat array with parsed metadata.
 */
function getAllSessions() {
  const agentSessions = discoverSessionFiles();
  const sessions = [];

  for (const [agentId, sessionMap] of agentSessions) {
    for (const [key, session] of Object.entries(sessionMap)) {
      if (!session || typeof session !== 'object') continue;

      sessions.push({
        key,
        agentId,
        sessionId: session.sessionId || null,
        updatedAt: session.updatedAt || null,
        modelProvider: session.modelProvider || null,
        model: session.model || null,
        inputTokens: session.inputTokens || 0,
        outputTokens: session.outputTokens || 0,
        contextTokens: session.contextTokens || 0,
        cliSessionIds: session.cliSessionIds || {},
        origin: session.origin || null,
      });
    }
  }

  return sessions;
}

/**
 * Get sessions grouped by agent ID.
 */
function getSessionsByAgent() {
  const agentSessions = discoverSessionFiles();
  const result = {};

  for (const [agentId, sessionMap] of agentSessions) {
    result[agentId] = [];
    for (const [key, session] of Object.entries(sessionMap)) {
      if (!session || typeof session !== 'object') continue;

      result[agentId].push({
        key,
        sessionId: session.sessionId || null,
        updatedAt: session.updatedAt || null,
        modelProvider: session.modelProvider || null,
        model: session.model || null,
        inputTokens: session.inputTokens || 0,
        outputTokens: session.outputTokens || 0,
        contextTokens: session.contextTokens || 0,
        cliSessionIds: session.cliSessionIds || {},
        origin: session.origin || null,
      });
    }
  }

  return result;
}

/**
 * Get sessions for a specific agent ID.
 */
function getSessionsForAgent(agentId) {
  const byAgent = getSessionsByAgent();
  return byAgent[agentId] || [];
}

/**
 * Get all session directory paths being watched.
 */
function getSessionWatchPaths() {
  const paths = [];
  for (const baseDir of SESSION_DIRS) {
    try {
      if (!fs.existsSync(baseDir)) continue;
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidates = [
          path.join(baseDir, entry.name, 'sessions'),
          path.join(baseDir, entry.name, 'agent', 'sessions'),
        ];
        for (const dir of candidates) {
          if (fs.existsSync(dir)) paths.push(dir);
        }
      }
    } catch {
      // ignore
    }
  }
  return paths;
}

module.exports = { getAllSessions, getSessionsByAgent, getSessionsForAgent, getSessionWatchPaths };
