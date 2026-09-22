#!/usr/bin/env node
const { isOptedOut } = require('../lib/runtime');

if (!isOptedOut()) {
  try {
    const fs = require('node:fs');
    const { loadInjectionBlock } = require('../lib/persona');
    const { readInput, validateInput } = require('./input');
    const { createCodexStore } = require('./store');
    const input = readInput();
    const checked = validateInput(input, { event: 'SessionStart', lifecycle: true });
    if (checked.ok) {
      const store = createCodexStore();
      store.updateSession(
        checked.id,
        (state, rawStore) => {
          state.host = 'codex';
          state.binding = {
            id: checked.id,
            cwd: checked.cwd,
            source: input.source,
            observedAt: new Date().toISOString(),
          };
          state.lastLifecycle = input.source;
          state.promptsSinceReinject = 0;
          rawStore.lastHook = {
            event: 'SessionStart',
            source: input.source,
            observedAt: new Date().toISOString(),
          };
          return state;
        },
        {
          initialize: true,
          cwd: checked.cwd,
          afterCommit: (state) => {
            if (state.current && state.current !== 'off') {
              const block = loadInjectionBlock(state.current);
              if (block)
                fs.writeSync(
                  1,
                  JSON.stringify({
                    hookSpecificOutput: {
                      hookEventName: 'SessionStart',
                      additionalContext: `Eridian mode "${state.current}" is active (persisted). Apply these style rules to all responses:\n\n${block}`,
                    },
                  })
                );
            }
          },
        }
      );
    }
  } catch {
    // Hook failures never block the Codex session.
  }
}
process.exit(0);
