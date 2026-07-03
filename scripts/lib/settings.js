'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SETTINGS_FILE =
  process.env.ERIDIAN_SETTINGS_FILE || path.join(os.homedir(), '.claude', 'settings.json');

function readSettings(filePath) {
  if (!fs.existsSync(filePath)) {
    return { ok: true, settings: {} };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { ok: false, error: `cannot parse ${filePath}: ${e.message}` };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: `${filePath} does not contain a JSON object` };
  }
  return { ok: true, settings: parsed };
}

function hasStatusLine(settings) {
  return Object.prototype.hasOwnProperty.call(settings, 'statusLine');
}

function buildStatusLineEntry(pluginRoot) {
  return {
    type: 'command',
    command: `node "${pluginRoot}/scripts/statusline.js"`,
  };
}

function addStatusLine(settings, pluginRoot) {
  if (hasStatusLine(settings)) {
    return { changed: false, settings };
  }
  return {
    changed: true,
    settings: { ...settings, statusLine: buildStatusLineEntry(pluginRoot) },
  };
}

function writeSettings(filePath, settings) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
  fs.renameSync(tmp, filePath);
}

module.exports = {
  readSettings,
  hasStatusLine,
  buildStatusLineEntry,
  addStatusLine,
  writeSettings,
  SETTINGS_FILE,
};
