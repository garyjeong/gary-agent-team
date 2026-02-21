/**
 * Chat history module - JSONL file-based storage on persistent volume.
 * Directory: /data/chat-history/
 * Files: YYYY-MM-DD.jsonl (one JSON object per line)
 */

const fs = require('fs');
const path = require('path');

const HISTORY_DIR = process.env.CHAT_HISTORY_DIR || '/data/chat-history';
const MAX_DAYS = 7;

// Ensure directory exists
function ensureDir() {
  if (!fs.existsSync(HISTORY_DIR)) {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  }
}

// Get YYYY-MM-DD string from timestamp
function dateStr(ts) {
  const d = new Date(ts || Date.now());
  return d.toISOString().slice(0, 10);
}

/**
 * Append a chat message to the daily JSONL file.
 * @param {object} msg - { id, type, from, to, content, timestamp, status }
 */
function appendMessage(msg) {
  try {
    ensureDir();
    const file = path.join(HISTORY_DIR, `${dateStr(msg.timestamp)}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(msg) + '\n', 'utf8');
  } catch (err) {
    console.error('[chat-history] appendMessage error:', err.message);
  }
}

/**
 * Read chat history for the last N days.
 * @param {number} days - Number of days to look back (default 7)
 * @param {string|null} agentId - Optional filter by agent ID
 * @returns {{ messages: object[], totalCount: number }}
 */
function getHistory(days = MAX_DAYS, agentId = null) {
  ensureDir();

  const messages = [];
  const now = Date.now();

  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * 86400000);
    const file = path.join(HISTORY_DIR, `${d.toISOString().slice(0, 10)}.jsonl`);

    if (!fs.existsSync(file)) continue;

    try {
      const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          if (agentId) {
            const matchFrom = msg.from?.id === agentId;
            const matchTo = msg.to?.id === agentId;
            if (!matchFrom && !matchTo) continue;
          }
          messages.push(msg);
        } catch {}
      }
    } catch (err) {
      console.error(`[chat-history] Error reading ${file}:`, err.message);
    }
  }

  // Sort by timestamp ascending
  messages.sort((a, b) => a.timestamp - b.timestamp);

  return { messages, totalCount: messages.length };
}

/**
 * Delete JSONL files older than maxDays.
 * Called once on server startup.
 */
function cleanOldFiles(maxDays = MAX_DAYS) {
  ensureDir();

  try {
    const cutoff = Date.now() - maxDays * 86400000;
    const files = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith('.jsonl'));

    for (const file of files) {
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/);
      if (!dateMatch) continue;

      const fileDate = new Date(dateMatch[1]).getTime();
      if (fileDate < cutoff) {
        fs.unlinkSync(path.join(HISTORY_DIR, file));
        console.log(`[chat-history] Cleaned old file: ${file}`);
      }
    }
  } catch (err) {
    console.error('[chat-history] cleanOldFiles error:', err.message);
  }
}

module.exports = { appendMessage, getHistory, cleanOldFiles };
