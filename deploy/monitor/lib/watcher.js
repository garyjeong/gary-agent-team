const fs = require('fs');
const path = require('path');
const { getSessionWatchPaths } = require('./sessions');
const { getLogWatchPath } = require('./logs');

/**
 * Set up file watchers for session and log directories.
 * Calls the `onEvent` callback whenever a relevant file changes.
 *
 * @param {function} onEvent - Callback receiving { type, agentId?, file, timestamp }
 * @returns {function} cleanup - Call to stop all watchers
 */
function startWatching(onEvent) {
  const watchers = [];

  // Watch session directories
  function watchSessions() {
    const sessionPaths = getSessionWatchPaths();
    for (const dir of sessionPaths) {
      try {
        const watcher = fs.watch(dir, { persistent: false }, (eventType, filename) => {
          if (!filename || !filename.endsWith('.json')) return;

          // Extract agent ID from the path
          const parts = dir.split(path.sep);
          // Path is like /home/node/.openclaw/agents/<agentId>/sessions
          // or /data/agents/<agentId>/agent/sessions
          const agentIdx = parts.indexOf('agents');
          const agentId = agentIdx >= 0 && agentIdx + 1 < parts.length
            ? parts[agentIdx + 1]
            : 'unknown';

          onEvent({
            type: 'session_update',
            agentId,
            file: filename,
            timestamp: Date.now(),
          });
        });
        watchers.push(watcher);
      } catch (err) {
        // Directory may not exist yet; that is fine
        console.error(`[watcher] Cannot watch ${dir}:`, err.message);
      }
    }
  }

  // Watch log directory
  function watchLogs() {
    const logDir = getLogWatchPath();
    try {
      if (!fs.existsSync(logDir)) return;
      const watcher = fs.watch(logDir, { persistent: false }, (eventType, filename) => {
        if (!filename) return;
        onEvent({
          type: 'log_update',
          file: filename,
          timestamp: Date.now(),
        });
      });
      watchers.push(watcher);
    } catch (err) {
      console.error(`[watcher] Cannot watch ${logDir}:`, err.message);
    }
  }

  watchSessions();
  watchLogs();

  // Re-scan for new session directories periodically (agents may be added at runtime)
  const rescanInterval = setInterval(() => {
    // Close existing session watchers and re-watch
    // (keep it simple: close all, re-create all)
    for (const w of watchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    watchers.length = 0;
    watchSessions();
    watchLogs();
  }, 30000); // Re-scan every 30 seconds

  return function cleanup() {
    clearInterval(rescanInterval);
    for (const w of watchers) {
      try { w.close(); } catch { /* ignore */ }
    }
    watchers.length = 0;
  };
}

module.exports = { startWatching };
