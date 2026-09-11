const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.env.ERIDIAN_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-ss-'));
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sessionSavings,
  currentSessionSaved,
  readCache,
  SESSIONS_DIR,
} = require('../scripts/lib/session-savings');
const fixture = require('./fixtures/session-accounting.json');
const factors = fixture.factors;
const state = fixture.sessions.alpha;
let sequence = 0;
function transcript(lines) {
  const file = path.join(process.env.ERIDIAN_STATE_DIR, `transcript-${sequence++}.jsonl`);
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return file;
}
function message(id, tokens, minute = 15, content = [{ type: 'text', text: 'Plain prose.' }]) {
  return {
    type: 'assistant',
    timestamp: `2026-07-08T10:${minute}:00Z`,
    message: { id, model: 'fixture-model', content, usage: { output_tokens: tokens } },
  };
}
function scan(id, file, calibration = factors, session = state) {
  return sessionSavings(
    { sessionId: id, transcriptPath: file },
    session,
    calibration,
    Date.parse('2026-07-08T11:00:00Z')
  );
}
test('activation inside old session, off and level changes use caller history', () => {
  const file = transcript([
    message('before', 10, '05'),
    message('on', 100),
    message('off', 500, 25),
    message('ultra', 20, 35),
  ]);
  const result = scan('activation', file);
  assert.equal(result.outputTokens, 120);
  assert.equal(result.savedTokens, 180);
  assert.equal(scan('other', file, factors, fixture.sessions.beta).savedTokens, null);
});
test('streamed duplicates merge cumulative usage; partial line waits for newline', () => {
  const file = transcript([message('one', 50), message('one', 100)]);
  assert.equal(scan('stream', file).savedTokens, 100);
  fs.appendFileSync(file, JSON.stringify(message('two', 50)));
  assert.equal(scan('stream', file).savedTokens, 100);
  fs.appendFileSync(file, '\n');
  assert.equal(scan('stream', file).savedTokens, 150);
  assert.equal(scan('stream', file).savedTokens, 150);
});
test('protected, mixed, unknown and unidentified output never becomes prose estimate', () => {
  const file = transcript([
    message('code', 100, 15, [{ type: 'text', text: '```js\nx()\n```' }]),
    message('tool', 100, 15, [{ type: 'tool_use' }]),
    message('unknown', 100, 15, undefined),
    message(null, 100),
  ]);
  // Explicitly missing content differs from helper default.
  fs.appendFileSync(
    file,
    JSON.stringify({
      ...message('absent', 100),
      message: { id: 'absent', model: 'fixture-model', usage: { output_tokens: 100 } },
    }) + '\n'
  );
  const result = scan('categories', file);
  assert.equal(result.eligibleOutputTokens, 100);
  assert.equal(result.unidentifiedOutputTokens, 100);
  assert.equal(result.savedTokens, 100);
});
test('calibration snapshots prevent repricing; incompatible model and scope unavailable', () => {
  const file = transcript([message('one', 100)]);
  assert.equal(scan('calibration', file).savedTokens, 100);
  assert.equal(scan('calibration', file, { ...factors, full: 0.9 }).savedTokens, 100);
  assert.equal(
    scan('wrong-model', file, {
      ...factors,
      _calibration: { ...factors._calibration, model: 'different' },
    }).savedTokens,
    null
  );
  assert.equal(scan('legacy-factor', file, { full: 0.5 }).savedTokens, null);
  assert.equal(scan('legacy-factor', file, factors).savedTokens, null);
});
test('zero and negative estimates are represented honestly', () => {
  const file = transcript([message('one', 100)]);
  assert.equal(scan('zero', file, { ...factors, full: 0 }).savedTokens, 0);
  assert.equal(scan('negative', file, { ...factors, full: -1 }).savedTokens, -50);
});
test('replacement rescans and cache schema retains provenance', () => {
  const file = transcript([message('one', 100)]);
  scan('replacement', file);
  fs.writeFileSync(file, JSON.stringify(message('two', 50)) + '\n');
  assert.equal(scan('replacement', file).savedTokens, 50);
  const cache = readCache('replacement');
  assert.equal(cache.version, 2);
  assert.equal(Object.values(cache.records)[0].calibration.id, 'fixture-v1');
});
test('milestones emit only once and current session requires exact identity', () => {
  const file = transcript([message('one', 6000)]);
  assert.deepEqual(scan('milestone', file).crossed, [5000]);
  assert.deepEqual(scan('milestone', file).crossed, []);
  assert.equal(currentSessionSaved('milestone'), 6000);
  assert.equal(currentSessionSaved(), null);
  assert.equal(currentSessionSaved('missing'), null);
});
test('invalid IDs, missing transcript, and corrupt caches fail safely', () => {
  assert.equal(scan('../evil', '/missing'), null);
  assert.equal(scan('missing', '/missing'), null);
  const file = transcript([message('one', 100)]);
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(SESSIONS_DIR, 'corrupt.json'), '{');
  assert.equal(scan('corrupt', file).savedTokens, 100);
  assert.ok(!fs.existsSync(path.join(SESSIONS_DIR, 'missing.json.lock')));
});
