const { codexPaths } = require('../lib/host-paths');

function paths(env = process.env, home, stateDir) {
  return codexPaths({ env, home, stateDir: stateDir || env.ERIDIAN_STATE_DIR });
}

module.exports = { paths };
