const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const MODES = ['off', 'lite', 'full', 'ultra'];
const MAX_CONFIG_BYTES = 4096;

function repoRoot(cwd) {
  const start = path.resolve(cwd);
  let dir = start;
  for (let depth = 0; depth < 256; depth++) {
    try {
      fs.lstatSync(path.join(dir, '.git'));
      return dir;
    } catch (error) {
      if (error.code !== 'ENOENT') return start;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function readConfig(file) {
  let fd;
  try {
    const absolute = path.resolve(file);
    const { root } = path.parse(absolute);
    let component = root;
    for (const segment of absolute.slice(root.length).split(path.sep)) {
      component = path.join(component, segment);
      const stat = fs.lstatSync(component);
      if (stat.isSymbolicLink() || (component === absolute && !stat.isFile()))
        return { invalid: true };
    }
    fd = fs.openSync(absolute, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) return { invalid: true };
    const buffer = Buffer.alloc(MAX_CONFIG_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const n = fs.readSync(fd, buffer, size, buffer.length - size, null);
      if (!n) break;
      size += n;
    }
    if (size > MAX_CONFIG_BYTES) return { invalid: true };
    const parsed = JSON.parse(buffer.subarray(0, size).toString('utf8'));
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      Object.keys(parsed).some((key) => key !== 'defaultMode') ||
      !MODES.includes(parsed.defaultMode)
    )
      return { invalid: true };
    return { mode: parsed.defaultMode };
  } catch (error) {
    return error.code === 'ENOENT' ? {} : { invalid: true };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function resolveConfig({
  sessionOverride,
  cwd = process.cwd(),
  env = process.env,
  home = os.homedir(),
  preference,
  diagnostic = (message) => console.error(message),
} = {}) {
  // Opt-out precedes path discovery, state/default reads and diagnostics.
  if (env.ERIDIAN_OFF === '1')
    return { mode: 'off', source: 'environment-opt-out', repoRoot: null };
  if (MODES.includes(sessionOverride))
    return { mode: sessionOverride, source: 'session-override', repoRoot: null };
  const root = repoRoot(typeof cwd === 'string' && cwd ? cwd : process.cwd());
  let invalid = false;
  const result = (mode, source) => {
    if (invalid) diagnostic('eridian: invalid default source ignored; using next valid source');
    return { mode, source, repoRoot: root };
  };
  if (env.ERIDIAN_DEFAULT_MODE !== undefined) {
    if (MODES.includes(env.ERIDIAN_DEFAULT_MODE))
      return result(env.ERIDIAN_DEFAULT_MODE, 'environment');
    invalid = true;
  }
  const files = [
    ['repository', path.join(root, '.eridian.json')],
    [
      'user',
      path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'eridian', 'config.json'),
    ],
  ];
  for (const [source, file] of files) {
    const parsed = readConfig(file);
    if (parsed.mode) return result(parsed.mode, source);
    invalid ||= parsed.invalid === true;
  }
  return result(
    MODES.includes(preference) ? preference : 'off',
    MODES.includes(preference) ? 'preference' : 'fallback'
  );
}

module.exports = { resolveConfig, readConfig, repoRoot, MODES, MAX_CONFIG_BYTES };
