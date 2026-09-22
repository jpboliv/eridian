#!/usr/bin/env node
try {
  const { isOptedOut } = require('./lib/runtime');
  if (isOptedOut()) process.exit(0);
  const { updateSession, sessionId } = require('./lib/state');
  const { loadInjectionBlock } = require('./lib/persona');

  let input = {};
  try {
    input = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
  } catch {
    /* absent identity */
  }
  const id = sessionId(input.session_id);
  if (!id) process.exit(0);
  updateSession(
    id,
    (s) => {
      s.promptsSinceReinject = 0;
      return s;
    },
    {
      initialize: true,
      cwd: input.cwd,
      afterCommit: (state) => {
        if (!state.current || state.current === 'off') return;
        const block = loadInjectionBlock(state.current);
        if (block)
          require('node:fs').writeSync(
            1,
            JSON.stringify({
              hookSpecificOutput: {
                hookEventName: 'SessionStart',
                additionalContext: `Eridian mode "${state.current}" is active (persisted). Apply these style rules to all responses:\n\n${block}`,
              },
            })
          );
      },
    }
  );
} catch {
  // never block session start
}
process.exit(0);
