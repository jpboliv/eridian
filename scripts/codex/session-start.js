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
      const inject = (state, notice) => {
        const block = state.current && state.current !== 'off' && loadInjectionBlock(state.current);
        if (!block && !notice) return;
        fs.writeSync(
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
          { initialize: true, cwd: checked.cwd, afterCommit: inject }
        );
      } catch (error) {
        // A refused write must not cost the session its mode.
        inject(
          store.readState(checked.id, { cwd: checked.cwd }),
          `${error.message}; mode not saved`
        );
      }
    }
  } catch {
    // Hook failures never block the Codex session.
  }
}
process.exit(0);
