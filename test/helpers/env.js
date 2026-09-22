const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Shell variables that change Eridian behavior and must never reach a test.
const LEAKS = [
  'ERIDIAN_DEFAULT_MODE',
  'ERIDIAN_OFF',
  'CLAUDE_SESSION_ID',
  'CODEX_THREAD_ID',
  'CODEX_HOME',
];

// Strips the leaks and points user config at an empty directory. Mutates `env` so
// that in-process modules and spawned scripts see the same isolation; call it before
// requiring any script and pass a copy of process.env when building a child env.
function isolateEnv(env = process.env) {
  for (const key of LEAKS) delete env[key];
  env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-test-xdg-'));
  return env;
}

module.exports = { LEAKS, isolateEnv };
