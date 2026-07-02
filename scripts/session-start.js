#!/usr/bin/env node
try {
  const { readState } = require('./lib/state');
  const { loadInjectionBlock } = require('./lib/persona');

  const state = readState();
  if (state.current && state.current !== 'off') {
    const block = loadInjectionBlock(state.current);
    if (block) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: `Eridian mode "${state.current}" is active (persisted). Apply these style rules to all responses:\n\n${block}`,
          },
        })
      );
    }
  }
} catch {
  // never block session start
}
process.exit(0);
