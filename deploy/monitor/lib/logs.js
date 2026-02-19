const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.OPENCLAW_LOG_DIR || '/tmp/openclaw';
const LOG_PATTERN = /^openclaw-.*\.log$/;
const DEFAULT_LINES = 50;

/**
 * Find the most recent OpenClaw log file in the log directory.
 */
function findLatestLogFile() {
  try {
    if (!fs.existsSync(LOG_DIR)) return null;

    const entries = fs.readdirSync(LOG_DIR)
      .filter((f) => LOG_PATTERN.test(f))
      .map((f) => ({
        name: f,
        path: path.join(LOG_DIR, f),
        mtime: fs.statSync(path.join(LOG_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return entries.length > 0 ? entries[0].path : null;
  } catch (err) {
    console.error('[logs] Error finding log files:', err.message);
    return null;
  }
}

/**
 * Read the last N lines from the most recent log file.
 */
function getRecentLogs(numLines) {
  const n = numLines || DEFAULT_LINES;
  const logFile = findLatestLogFile();

  if (!logFile) {
    return { file: null, lines: [], totalLines: 0 };
  }

  try {
    const content = fs.readFileSync(logFile, 'utf-8');
    const allLines = content.split('\n').filter((l) => l.length > 0);
    const lines = allLines.slice(-n);

    return {
      file: path.basename(logFile),
      lines,
      totalLines: allLines.length,
    };
  } catch (err) {
    console.error('[logs] Error reading log file:', err.message);
    return { file: path.basename(logFile), lines: [], totalLines: 0 };
  }
}

/**
 * Get the log file path for fs.watch (used by watcher).
 */
function getLogWatchPath() {
  return LOG_DIR;
}

module.exports = { getRecentLogs, getLogWatchPath, findLatestLogFile };
