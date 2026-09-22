#!/usr/bin/env node
const { isOptedOut } = require('../lib/runtime');

if (!isOptedOut()) {
  try {
    const fs = require('node:fs');
    const { loadInjectionBlock } = require('../lib/persona');
    const { classifyPrompt } = require('../lib/classify');
    const { notePrompt } = require('../lib/reinforcement');
    const { readInput, validateInput } = require('./input');
    const { createCodexStore } = require('./store');
    const input = readInput();
    const checked = validateInput(input, { event: 'UserPromptSubmit' });
    if (checked.ok) {
      const store = createCodexStore();
      if (store.readStore().sessions[checked.id]) {
        let reinjectLevel = null;
        store.updateSession(
          checked.id,
          (state, rawStore) => {
            const key = typeof input.turn_id === 'string' && input.turn_id ? input.turn_id : null;
            state.recentPromptEvents = Array.isArray(state.recentPromptEvents)
              ? state.recentPromptEvents.filter((item) => typeof item === 'string').slice(-31)
              : [];
            if (key && state.recentPromptEvents.includes(key)) return state;
            if (key) state.recentPromptEvents.push(key);
            reinjectLevel = notePrompt(state, {
              prompt: input.prompt,
              classify: classifyPrompt,
              recordActivation: store.recordActivation,
            });
            rawStore.lastHook = { event: 'UserPromptSubmit', observedAt: new Date().toISOString() };
            return state;
          },
          {
            cwd: checked.cwd,
            afterCommit: () => {
              if (reinjectLevel) {
                const block = loadInjectionBlock(reinjectLevel);
                if (block)
                  fs.writeSync(
                    1,
                    JSON.stringify({
                      hookSpecificOutput: {
                        hookEventName: 'UserPromptSubmit',
                        additionalContext: `Eridian mode "${reinjectLevel}" reminder (long session — re-asserting style):\n\n${block}`,
                      },
                    })
                  );
              }
            },
          }
        );
      }
    }
  } catch {
    // Hook failures never block the prompt.
  }
}
process.exit(0);
