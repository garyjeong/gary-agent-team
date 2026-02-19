const { execSync } = require('child_process');

// Threshold in milliseconds: sessions updated within this window are "active"
const ACTIVE_THRESHOLD_MS = 60 * 1000; // 60 seconds

/**
 * Check if a CLI process is currently running for a given agent.
 * Looks for claude processes whose config dir or arguments reference the agent ID.
 */
function isCliRunning(agentId) {
  try {
    const output = execSync(
      `pgrep -af "claude.*${agentId}" 2>/dev/null || true`,
      { encoding: 'utf-8', timeout: 3000 }
    ).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

/**
 * Determine agent status based on session activity and CLI process.
 *
 * - active:  CLI process running OR session updated within ACTIVE_THRESHOLD_MS
 * - idle:    sessions exist but none updated recently and no CLI running
 * - offline: no session data found
 */
function getAgentStatus(agentSessions, agentId) {
  if (!agentSessions || agentSessions.length === 0) {
    return 'offline';
  }

  // Check if CLI process is actively running for this agent
  if (agentId && isCliRunning(agentId)) {
    return 'active';
  }

  const now = Date.now();
  const hasRecent = agentSessions.some((session) => {
    if (!session.updatedAt) return false;
    return (now - session.updatedAt) < ACTIVE_THRESHOLD_MS;
  });

  return hasRecent ? 'active' : 'idle';
}

/**
 * Get the most recent updatedAt timestamp from a list of sessions.
 */
function getLastActivity(agentSessions) {
  if (!agentSessions || agentSessions.length === 0) return null;

  let latest = 0;
  for (const session of agentSessions) {
    if (session.updatedAt && session.updatedAt > latest) {
      latest = session.updatedAt;
    }
  }

  return latest > 0 ? latest : null;
}

/**
 * Sum up token usage across a list of sessions.
 */
function sumTokenUsage(sessions) {
  let inputTokens = 0;
  let outputTokens = 0;

  for (const session of sessions) {
    inputTokens += session.inputTokens || 0;
    outputTokens += session.outputTokens || 0;
  }

  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

/**
 * Check if the OpenClaw main process is running.
 */
function isOpenClawRunning() {
  try {
    const output = execSync('pgrep -f "openclaw.mjs" 2>/dev/null || true', {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    return output.length > 0;
  } catch {
    return false;
  }
}

module.exports = {
  ACTIVE_THRESHOLD_MS,
  getAgentStatus,
  getLastActivity,
  sumTokenUsage,
  isOpenClawRunning,
  isCliRunning,
};
