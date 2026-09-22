#!/usr/bin/env node
const { isOptedOut } = require('./lib/runtime');
if (isOptedOut()) process.exit(0);

function main(raw) {
  const { updateSession, sessionId, recordActivation } = require('./lib/state');
  const { classifyPrompt } = require('./lib/classify');
  const { notePrompt } = require('./lib/reinforcement');

  const kind = process.argv[2];
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    /* tolerate bad stdin */
  }
  const id = sessionId(input.session_id);
  if (!id) return;
  const update = (fn, options) => updateSession(id, fn, { ...options, cwd: input.cwd });
  const now = new Date().toISOString();

  if (kind === 'prompt') {
    let reinjectLevel = null;
    update(
      (s) => {
        reinjectLevel = notePrompt(s, {
          prompt: input.prompt,
          now,
          classify: classifyPrompt,
          recordActivation,
        });
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
