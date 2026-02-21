const { execSync } = require('child_process');

// Threshold in milliseconds: sessions updated within this window are "active"
const ACTIVE_THRESHOLD_MS = 60 * 1000; // 60 seconds

// In-memory chat activity tracking (most reliable status source)
// Map<agentId, { chatStarted: number, chatEnded: number }>
const chatActivity = new Map();

/**
 * Record that a chat has started for an agent.
 */
function markChatStarted(agentId) {
  const existing = chatActivity.get(agentId) || { chatStarted: 0, chatEnded: 0 };
  existing.chatStarted = Date.now();
  chatActivity.set(agentId, existing);
}

/**
 * Record that a chat has completed for an agent.
 */
function markChatEnded(agentId) {
  const existing = chatActivity.get(agentId) || { chatStarted: 0, chatEnded: 0 };
  existing.chatEnded = Date.now();
  chatActivity.set(agentId, existing);
}

/**
 * Check if an agent is currently chatting or was recently active via chat.
 */
function isChatActive(agentId) {
  const activity = chatActivity.get(agentId);
  if (!activity) return false;
  const now = Date.now();
  // Currently in a chat (started but not ended, or started after last end)
  if (activity.chatStarted > activity.chatEnded) return true;
  // Recently finished a chat (within threshold)
  if (activity.chatEnded > 0 && (now - activity.chatEnded) < ACTIVE_THRESHOLD_MS) return true;
  return false;
}

/**
 * Check if a CLI process is currently running for a given agent.
 * Looks for openclaw or claude processes referencing the agent ID.
 */
function isCliRunning(agentId) {
  try {
    // Match both openclaw agent commands and claude CLI backend processes
    const output = execSync(
      `pgrep -af "agent.*--agent.*${agentId}|claude.*${agentId}" 2>/dev/null || true`,
      { encoding: 'utf-8', timeout: 3000 }
    ).trim();
    // Filter out the pgrep command itself
    const lines = output.split('\n').filter(l => l.trim() && !l.includes('pgrep'));
    return lines.length > 0;
  } catch {
    return false;
  }
}

/**
 * Determine agent status based on chat activity, session data, and CLI process.
 *
 * - active:  chat in progress, recently chatted, CLI running, or session updated recently
 * - idle:    sessions exist or has been chatted with before, but not recently active
 * - offline: no session data and never chatted
 */
function getAgentStatus(agentSessions, agentId) {
  // 1. Check in-memory chat activity (most reliable)
  if (agentId && isChatActive(agentId)) {
    return 'active';
  }

  // 2. Check if CLI process is actively running
  if (agentId && isCliRunning(agentId)) {
    return 'active';
  }

  // 3. Check session file timestamps
  const now = Date.now();
  if (agentSessions && agentSessions.length > 0) {
    const hasRecent = agentSessions.some((session) => {
      if (!session.updatedAt) return false;
      return (now - session.updatedAt) < ACTIVE_THRESHOLD_MS;
    });
    return hasRecent ? 'active' : 'idle';
  }

  // 4. If agent was previously chatted with but has no sessions, show as idle
  if (agentId && chatActivity.has(agentId)) {
    return 'idle';
  }

  return 'offline';
}

/**
 * Get the most recent activity timestamp from sessions and chat activity.
 */
function getLastActivity(agentSessions, agentId) {
  let latest = 0;

  if (agentSessions && agentSessions.length > 0) {
    for (const session of agentSessions) {
      if (session.updatedAt && session.updatedAt > latest) {
        latest = session.updatedAt;
      }
    }
  }

  // Also check in-memory chat activity
  if (agentId) {
    const activity = chatActivity.get(agentId);
    if (activity) {
      if (activity.chatEnded > latest) latest = activity.chatEnded;
      if (activity.chatStarted > latest) latest = activity.chatStarted;
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
  markChatStarted,
  markChatEnded,
};
