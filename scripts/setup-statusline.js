#!/usr/bin/env node
// scripts/setup-statusline.js
const { readSettings, hasStatusLine, addStatusLine, writeSettings, SETTINGS_FILE } =
  require('./lib/settings');

const [mode, pluginRoot] = process.argv.slice(2);

if (mode !== 'check' && mode !== 'apply') {
  console.log('usage: setup-statusline.js <check|apply> <plugin-root>');
  process.exit(1);
}

const result = readSettings(SETTINGS_FILE);
if (!result.ok) {
  console.log(`error: ${result.error}`);
  process.exit(1);
}

if (mode === 'check') {
  if (hasStatusLine(result.settings)) {
    console.log(`already-configured: ${JSON.stringify(result.settings.statusLine)}`);
  } else {
    console.log('not-configured');
  }
  process.exit(0);
}

if (!pluginRoot) {
  console.log('usage: setup-statusline.js apply <plugin-root>');
  process.exit(1);
}

const { changed, settings } = addStatusLine(result.settings, pluginRoot);

if (!changed) {
  console.log(`already-configured: ${JSON.stringify(settings.statusLine)}`);
  process.exit(0);
}

try {
  writeSettings(SETTINGS_FILE, settings);
} catch (e) {
  console.log(`error: failed to write settings file: ${e.message}`);
  process.exit(1);
}

console.log(`added: ${JSON.stringify(settings.statusLine)}`);
process.exit(0);
