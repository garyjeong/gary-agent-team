const fs = require('fs');
const path = require('path');
const { readConfig, getAgentsList } = require('./config');

// Cache with 60s TTL
const CACHE_TTL = 60_000;
let cache = { data: null, timestamp: 0 };

const CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || '/opt/claude-config';
const AGENT_WORKSPACE_DIRS = ['/data/agents', '/home/node/.openclaw/agents'];

// Parse YAML-style frontmatter from SKILL.md
function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split('\n')) {
    // Handle simple key: value (skip multiline)
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv) {
      fm[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return fm;
}

// Read all skills from skills directory
function getSkills() {
  const skillsDir = path.join(CLAUDE_CONFIG_DIR, 'skills');
  if (!fs.existsSync(skillsDir)) return [];

  const skills = [];
  try {
    const dirs = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const skillMd = path.join(skillsDir, dir.name, 'SKILL.md');
      try {
        if (!fs.existsSync(skillMd)) continue;
        const content = fs.readFileSync(skillMd, 'utf-8');
        const fm = parseFrontmatter(content);
        skills.push({
          name: fm.name || dir.name,
          description: (fm.description || '').substring(0, 200),
        });
      } catch {
        skills.push({ name: dir.name, description: '' });
      }
    }
  } catch (err) {
    console.error('[environment] Error reading skills:', err.message);
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

// Read enabled plugins from settings + installed_plugins
function getPlugins() {
  const plugins = [];
  try {
    const settingsPath = path.join(CLAUDE_CONFIG_DIR, 'settings.json');
    const installedPath = path.join(CLAUDE_CONFIG_DIR, 'plugins', 'installed_plugins.json');

    let enabledPlugins = {};
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      enabledPlugins = settings.enabledPlugins || {};
    }

    let installedPlugins = {};
    if (fs.existsSync(installedPath)) {
      const installed = JSON.parse(fs.readFileSync(installedPath, 'utf-8'));
      installedPlugins = installed.plugins || {};
    }

    for (const [pluginId, enabled] of Object.entries(enabledPlugins)) {
      if (!enabled) continue;
      const parts = pluginId.split('@');
      const name = parts[0] || pluginId;
      const marketplace = parts[1] || '';

      // Get install details
      const installs = installedPlugins[pluginId];
      const install = Array.isArray(installs) ? installs[0] : null;

      plugins.push({
        id: pluginId,
        name,
        marketplace,
        version: install?.version || null,
        installedAt: install?.installedAt || null,
      });
    }
  } catch (err) {
    console.error('[environment] Error reading plugins:', err.message);
  }
  return plugins;
}

// Parse TOOLS.md for an agent
function parseToolsMd(content) {
  const result = { allowed: [], forbidden: [], cron: [] };
  let section = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (/^##\s*허용\s*도구/i.test(trimmed)) { section = 'allowed'; continue; }
    if (/^##\s*금지\s*도구/i.test(trimmed)) { section = 'forbidden'; continue; }
    if (/^##\s*Cron\s*작업/i.test(trimmed)) { section = 'cron'; continue; }
    if (trimmed.startsWith('## ')) { section = null; continue; }
    if (trimmed.startsWith('#')) continue;

    if (section && trimmed.startsWith('- ')) {
      const item = trimmed.slice(2).trim();
      if (item) result[section].push(item);
    }
  }
  return result;
}

// Read agent tools from workspace TOOLS.md
function getAgentTools() {
  const agents = getAgentsList();
  const agentTools = {};

  for (const agent of agents) {
    // Try workspace path from config first, then fallback directories
    const candidates = [
      agent.workspace ? path.join(agent.workspace, 'TOOLS.md') : null,
      ...AGENT_WORKSPACE_DIRS.map(d => path.join(d, agent.id, 'workspace', 'TOOLS.md')),
    ].filter(Boolean);

    let found = false;
    for (const toolsPath of candidates) {
      try {
        if (fs.existsSync(toolsPath)) {
          const content = fs.readFileSync(toolsPath, 'utf-8');
          agentTools[agent.id] = parseToolsMd(content);
          found = true;
          break;
        }
      } catch { /* skip */ }
    }
    if (!found) {
      agentTools[agent.id] = { allowed: [], forbidden: [], cron: [] };
    }
  }
  return agentTools;
}

// Extract CLI backend info from config
function getCliBackends() {
  try {
    const config = readConfig();
    const backends = config?.agents?.defaults?.cliBackends || {};
    return Object.entries(backends).map(([id, cfg]) => {
      // Extract label from comment or derive from id
      let label = id;
      if (id === 'claude-viewster') label = 'Max 20x';
      else if (id === 'claude-gary') label = 'Max 5x';
      return { id, label };
    });
  } catch {
    return [];
  }
}

function getEnvironmentInfo() {
  const now = Date.now();
  if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
    return cache.data;
  }

  const data = {
    plugins: getPlugins(),
    skills: getSkills(),
    agentTools: getAgentTools(),
    cliBackends: getCliBackends(),
  };

  cache = { data, timestamp: now };
  return data;
}

module.exports = { getEnvironmentInfo };
