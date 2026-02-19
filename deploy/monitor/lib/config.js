const fs = require('fs');
const JSON5 = require('json5');

const CONFIG_PATH = process.env.OPENCLAW_CONFIG || '/home/node/.openclaw/openclaw.json';

/**
 * Read and parse the OpenClaw configuration file (JSON5 format).
 * Returns the agents.list array or an empty array on failure.
 */
function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON5.parse(raw);
    return config;
  } catch (err) {
    console.error(`[config] Failed to read ${CONFIG_PATH}:`, err.message);
    return null;
  }
}

/**
 * Get the list of configured agents with their metadata.
 */
function getAgentsList() {
  const config = readConfig();
  if (!config || !config.agents || !Array.isArray(config.agents.list)) {
    return [];
  }

  return config.agents.list.map((agent) => ({
    id: agent.id,
    name: agent.name || agent.id,
    workspace: agent.workspace || null,
    agentDir: agent.agentDir || null,
    model: agent.model || null,
  }));
}

module.exports = { readConfig, getAgentsList };
