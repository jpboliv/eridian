const { normalizeLevel } = require('./persona');
const { resolveConfig } = require('./config');

function resolveTarget(arg, current) {
  const value = String(arg || '').trim();
  if (!value) return current === 'off' ? 'full' : 'off';
  if (value === 'reset') return 'reset';
  return normalizeLevel(value);
}

function transition(state, store, arg, { resolve = resolveConfig, cwd, recordActivation } = {}) {
  const target = resolveTarget(arg, state.current);
  if (!target) return { ok: false, error: `unknown level "${String(arg).trim()}"` };
  if (target === 'reset') {
    const resolved = resolve({ preference: store.preferences.current, cwd });
    state.current = resolved.mode;
    state.modeOverride = null;
    state.resolvedSource = resolved.source;
    state.repoRoot = resolved.repoRoot;
  } else {
    state.current = target;
    state.modeOverride = target;
    state.resolvedSource = 'session-override';
    if (store) store.preferences.current = target;
  }
  if (recordActivation) recordActivation(state, state.current);
  state.promptsSinceReinject = 0;
  return { ok: true, target: state.current, state };
}

module.exports = { resolveTarget, transition };
