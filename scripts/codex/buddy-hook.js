#!/usr/bin/env node
const { isOptedOut } = require('../lib/runtime');

if (!isOptedOut()) {
  try {
    const { readInput, validateInput } = require('./input');
    const { createCodexStore } = require('./store');
    const { classifyPrompt } = require('../lib/classify');
    const input = readInput();
    const checked = validateInput(input, { event: 'PostToolUse' });
    if (checked.ok) {
      const store = createCodexStore();
      if (store.readStore().sessions[checked.id]) {
        store.updateSession(
          checked.id,
          (state, rawStore) => {
            const now = new Date().toISOString();
            state.buddy = state.buddy || {};
            state.buddy.lastToolAt = now;
            const response = input.tool_response;
            if (
              response?.is_error === true ||
              response?.isError === true ||
              (typeof response === 'string' && /^error/i.test(response))
            )
              state.buddy.lastErrorAt = now;
            if (input.prompt) state.buddy.promptClass = classifyPrompt(input.prompt);
            rawStore.lastHook = { event: 'PostToolUse', observedAt: now };
            return state;
          },
          { cwd: checked.cwd }
        );
      }
    }
  } catch {
    // Buddy reactions are advisory and never block tool execution.
  }
}
process.exit(0);
