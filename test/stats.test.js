const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const { collectMessages } = require('../scripts/lib/collect-messages');

function writeSession(dir, project, session, lines) {
  const projectDir = path.join(dir, project);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, `${session}.jsonl`), lines.join('\n'));
}

function tmpProjectsDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-stats-'));
}

test('collectMessages counts well-formed assistant messages', () => {
  const dir = tmpProjectsDir();
  writeSession(dir, 'proj-a', 'sess-1', [
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-07-02T10:00:00.000Z',
      message: { usage: { output_tokens: 42 } },
    }),
  ]);
  const { messages, sessions } = collectMessages(dir);
  assert.strictEqual(sessions, 1);
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].outputTokens, 42);
});

test('collectMessages skips malformed JSON lines without throwing', () => {
  const dir = tmpProjectsDir();
  writeSession(dir, 'proj-a', 'sess-1', [
    '{not json!!',
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-07-02T10:00:00.000Z',
      message: { usage: { output_tokens: 10 } },
    }),
  ]);
  assert.doesNotThrow(() => collectMessages(dir));
  const { messages } = collectMessages(dir);
  assert.strictEqual(messages.length, 1);
  assert.strictEqual(messages[0].outputTokens, 10);
});

test('collectMessages skips assistant messages missing usage.output_tokens', () => {
  const dir = tmpProjectsDir();
  writeSession(dir, 'proj-a', 'sess-1', [
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-07-02T10:00:00.000Z',
      message: {},
    }),
  ]);
  const { messages } = collectMessages(dir);
  assert.strictEqual(messages.length, 0);
});

test('collectMessages skips non-assistant message types', () => {
  const dir = tmpProjectsDir();
  writeSession(dir, 'proj-a', 'sess-1', [
    JSON.stringify({
      type: 'user',
      timestamp: '2026-07-02T10:00:00.000Z',
      message: { usage: { output_tokens: 99 } },
    }),
  ]);
  const { messages } = collectMessages(dir);
  assert.strictEqual(messages.length, 0);
});

test('collectMessages attributes sessionStartMs per session across multiple projects', () => {
  const dir = tmpProjectsDir();
  writeSession(dir, 'proj-a', 'sess-1', [
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-07-02T10:05:00.000Z',
      message: { usage: { output_tokens: 5 } },
    }),
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-07-02T10:00:00.000Z',
      message: { usage: { output_tokens: 7 } },
    }),
  ]);
  writeSession(dir, 'proj-b', 'sess-2', [
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-07-02T11:00:00.000Z',
      message: { usage: { output_tokens: 3 } },
    }),
  ]);
  const { messages, sessions } = collectMessages(dir);
  assert.strictEqual(sessions, 2);
  assert.strictEqual(messages.length, 3);

  const sess1Start = Date.parse('2026-07-02T10:00:00.000Z');
  const sess1Messages = messages.filter((m) => m.outputTokens === 5 || m.outputTokens === 7);
  for (const m of sess1Messages) {
    assert.strictEqual(m.sessionStartMs, sess1Start);
  }
  const sess2Message = messages.find((m) => m.outputTokens === 3);
  assert.strictEqual(sess2Message.sessionStartMs, Date.parse('2026-07-02T11:00:00.000Z'));
});
