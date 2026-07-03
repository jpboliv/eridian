#!/usr/bin/env node
// Long sessions dilute the once-at-SessionStart persona instruction, so
// re-assert it periodically via UserPromptSubmit (whose plain stdout Claude
// Code shows to Claude, unlike most other hook events).
const REINJECT_EVERY_PROMPTS = 20;

function main(raw) {
  const { update } = require('./lib/state');
  const { classifyPrompt } = require('./lib/classify');

  const kind = process.argv[2];
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    /* tolerate bad stdin */
  }
  const now = new Date().toISOString();

  if (kind === 'prompt') {
    let reinjectLevel = null;
    update((s) => {
      s.buddy.lastPromptAt = now;
      s.buddy.promptClass = classifyPrompt(input.prompt);
      if (s.current && s.current !== 'off') {
        s.promptsSinceReinject = (s.promptsSinceReinject || 0) + 1;
        if (s.promptsSinceReinject >= REINJECT_EVERY_PROMPTS) {
          s.promptsSinceReinject = 0;
          reinjectLevel = s.current;
        }
      }
      return s;
    });
    if (reinjectLevel) {
      const { loadInjectionBlock } = require('./lib/persona');
      const block = loadInjectionBlock(reinjectLevel);
      if (block) {
        process.stdout.write(
          `Eridian mode "${reinjectLevel}" reminder (long session — re-asserting style):\n\n${block}`
        );
      }
    }
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
