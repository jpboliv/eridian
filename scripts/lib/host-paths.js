const os = require('node:os');
const path = require('node:path');

function codexPaths({ env = process.env, home = os.homedir(), stateDir } = {}) {
  const override = stateDir || env.ERIDIAN_STATE_DIR;
  const root = override
    ? path.join(path.resolve(override), 'codex')
    : path.join(path.resolve(env.CODEX_HOME || path.join(home, '.codex')), 'eridian');
  const claude = path.join(home, '.claude', 'eridian');
  if (path.resolve(root) === path.resolve(claude))
    throw new Error('Codex state root cannot be the Claude state directory');
  return {
    stateDir: root,
    stateFile: path.join(root, 'state.json'),
    sessionsDir: path.join(root, 'sessions'),
    diagnosticsDir: path.join(root, 'diagnostics'),
    backupsDir: path.join(root, 'backups'),
  };
}

module.exports = { codexPaths };
