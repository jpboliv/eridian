#!/usr/bin/env node
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
    update((s) => {
      s.buddy.lastPromptAt = now;
      s.buddy.promptClass = classifyPrompt(input.prompt);
      return s;
    });
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
