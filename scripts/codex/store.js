const { createStateStore } = require('../lib/state-store');
const { resolveConfig } = require('../lib/config');
const { codexPaths } = require('../lib/host-paths');

function createCodexStore({ env = process.env, home, stateDir } = {}) {
  const resolved = codexPaths({ env, home, stateDir });
  return createStateStore({
    stateDir: resolved.stateDir,
    resolveConfig,
    configOptions: { env, ...(home ? { home } : {}) },
  });
}

module.exports = { createCodexStore };
