#!/usr/bin/env node
// Full refresh after 20 active prompts since the last lifecycle/mode reset.
// This conservative default is retained pending human-reviewed cadence evidence.
// UserPromptSubmit stdout is visible to Claude.
const REINJECT_EVERY_PROMPTS = 20;

const { isOptedOut } = require('./lib/runtime');
if (isOptedOut()) process.exit(0);

function main(raw) {
  const { updateSession, sessionId, recordActivation } = require('./lib/state');
  const { classifyPrompt } = require('./lib/classify');

  const kind = process.argv[2];
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    /* tolerate bad stdin */
  }
  const id = sessionId(input.session_id);
  if (!id) return;
  const update = (fn, options) => updateSession(id, fn, options);
  const now = new Date().toISOString();

  if (kind === 'prompt') {
    let reinjectLevel = null;
    update(
      (s) => {
        s.buddy.lastPromptAt = now;
        s.buddy.promptClass = classifyPrompt(input.prompt);
        if (s.current && s.current !== 'off') {
          s.promptsSinceReinject = (s.promptsSinceReinject || 0) + 1;
          if (s.promptsSinceReinject >= REINJECT_EVERY_PROMPTS) {
            s.promptsSinceReinject = 0;
            reinjectLevel = s.current;
            recordActivation(s, s.current, false);
          }
        }
        return s;
      },
      {
        afterCommit: () => {
          // Emit while holding the session transaction lock. A concurrent off/mode
          // command cannot commit before an already-selected reminder is emitted.
          if (reinjectLevel) {
            const { loadInjectionBlock } = require('./lib/persona');
            const block = loadInjectionBlock(reinjectLevel);
            if (block)
              require('node:fs').writeSync(
                1,
                `Eridian mode "${reinjectLevel}" reminder (long session — re-asserting style):\n\n${block}`
              );
          }
        },
      }
    );
  } else if (kind === 'post-tool') {
    const resp = input.tool_response;
    const isError =
      (resp && (resp.is_error === true || resp.isError === true)) ||
      (typeof resp === 'string' && /^error/i.test(resp));
    update((s) => {
      s.buddy.lastToolAt = now;
      if (isError) s.buddy.lastErrorAt = now;
      return s;
    });
  }
}

let raw = '';
process.stdin.on('data', (c) => {
  raw += c;
});
process.stdin.on('end', () => {
  try {
    main(raw);
  } catch {
    /* never block tool calls */
  }
  process.exit(0);
});
