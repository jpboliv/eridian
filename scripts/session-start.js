#!/usr/bin/env node
try {
  const { isOptedOut } = require('./lib/runtime');
  if (isOptedOut()) process.exit(0);
  const { readState, updateSession, sessionId } = require('./lib/state');
  const { loadInjectionBlock } = require('./lib/persona');

  let input = {};
  try {
    input = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
  } catch {
    /* absent identity */
  }
  const id = sessionId(input.session_id);
  if (!id) process.exit(0);
  const inject = (state, notice) => {
    const block = state.current && state.current !== 'off' && loadInjectionBlock(state.current);
    if (!block && !notice) return;
    require('node:fs').writeSync(
      1,
      JSON.stringify({
        systemMessage: notice,
        hookSpecificOutput: block
          ? {
              hookEventName: 'SessionStart',
              additionalContext: `Eridian mode "${state.current}" is active (persisted). Apply these style rules to all responses:\n\n${block}`,
            }
          : undefined,
      })
    );
  };
  try {
    updateSession(
      id,
      (s) => {
        s.promptsSinceReinject = 0;
        return s;
      },
      { initialize: true, cwd: input.cwd, afterCommit: inject }
    );
  } catch (error) {
    // A refused write must not cost the session its mode.
    inject(readState(id, { cwd: input.cwd }), `${error.message}; mode not saved`);
  }
} catch {
  // never block session start
}
process.exit(0);
