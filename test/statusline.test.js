const test = require('node:test');
const assert = require('node:assert');
const { renderLines, formatTokens } = require('../scripts/statusline.js');

const NOW = Date.parse('2026-07-02T12:00:01Z');

test('renders nothing when off', () => {
  assert.deepStrictEqual(renderLines({ current: 'off', buddy: {} }, NOW), []);
});

test('3 rows, quip on the top row, level+savings on the body row', () => {
  const lines = renderLines({ current: 'full', buddy: {} }, NOW, 12300);
  assert.strictEqual(lines.length, 3);
  assert.match(lines[0], /♫/);
  assert.match(lines[1], /∙\s*full/);
  assert.match(lines[1], /~12\.3k saved/);
});

test('omits savings segment when session savings unavailable', () => {
  const lines = renderLines({ current: 'lite', buddy: {} }, NOW, null);
  assert.ok(lines.every((l) => !l.includes('saved')));
  assert.ok(lines.some((l) => /lite/.test(l)));
});

test('formatTokens', () => {
  assert.strictEqual(formatTokens(900), '900');
  assert.strictEqual(formatTokens(12300), '12.3k');
  assert.strictEqual(formatTokens(1500000), '1.5M');
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'statusline.js');

function cliEnv() {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-sl-'));
  fs.writeFileSync(
    path.join(stateDir, 'state.json'),
    JSON.stringify({
      current: 'full',
      events: [{ ts: '2026-07-08T09:00:00.000Z', level: 'full' }],
      buddy: {},
    })
  );
  return { stateDir, env: { ...process.env, ERIDIAN_STATE_DIR: stateDir } };
}

test('CLI: renders session savings from stdin session JSON', () => {
  const { stateDir, env } = cliEnv();
  const transcript = path.join(stateDir, 'transcript.jsonl');
  fs.writeFileSync(
    transcript,
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-07-08T10:00:00.000Z',
      message: { usage: { output_tokens: 1000 } },
    }) + '\n'
  );
  const out = execFileSync('node', [SCRIPT], {
    env,
    input: JSON.stringify({ session_id: 'cli-sess', transcript_path: transcript }),
  }).toString();
  assert.match(out, /saved/);
});

test('CLI: empty stdin still renders the buddy, without savings', () => {
  const { env } = cliEnv();
  const out = execFileSync('node', [SCRIPT], { env, input: '' }).toString();
  assert.match(out, /full/);
  assert.ok(!out.includes('saved'));
});

test('CLI: each invocation advances buddy.frame and the rendered pose', () => {
  const { stateDir, env } = cliEnv();
  const stateFile = path.join(stateDir, 'state.json');
  const out1 = execFileSync('node', [SCRIPT], { env, input: '' }).toString();
  assert.strictEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).buddy.frame, 1);
  const out2 = execFileSync('node', [SCRIPT], { env, input: '' }).toString();
  assert.strictEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).buddy.frame, 2);
  assert.notStrictEqual(out1, out2, 'consecutive refreshes render different poses');
});

test('CLI: off mode leaves buddy.frame untouched', () => {
  const { stateDir, env } = cliEnv();
  const stateFile = path.join(stateDir, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ current: 'off', events: [], buddy: {} }));
  execFileSync('node', [SCRIPT], { env, input: '' });
  assert.ok(!('frame' in JSON.parse(fs.readFileSync(stateFile, 'utf8')).buddy));
});

test('CLI: buddy.stepSeconds holds the frame between rapid refreshes', () => {
  const { stateDir, env } = cliEnv();
  const stateFile = path.join(stateDir, 'state.json');
  fs.writeFileSync(
    stateFile,
    JSON.stringify({ current: 'full', events: [], buddy: { stepSeconds: 60 } })
  );
  execFileSync('node', [SCRIPT], { env, input: '' });
  const after1 = JSON.parse(fs.readFileSync(stateFile, 'utf8')).buddy;
  assert.strictEqual(after1.frame, 1, 'first refresh steps (no lastStepAt yet)');
  assert.ok(after1.lastStepAt, 'lastStepAt stamped');
  execFileSync('node', [SCRIPT], { env, input: '' });
  const after2 = JSON.parse(fs.readFileSync(stateFile, 'utf8')).buddy;
  assert.strictEqual(after2.frame, 1, 'second refresh within 60s holds the frame');
  assert.strictEqual(after2.lastStepAt, after1.lastStepAt, 'lastStepAt unchanged on hold');
});

test('CLI: stale lastStepAt advances the frame', () => {
  const { stateDir, env } = cliEnv();
  const stateFile = path.join(stateDir, 'state.json');
  fs.writeFileSync(
    stateFile,
    JSON.stringify({
      current: 'full',
      events: [],
      buddy: { stepSeconds: 60, frame: 4, lastStepAt: '2020-01-01T00:00:00.000Z' },
    })
  );
  execFileSync('node', [SCRIPT], { env, input: '' });
  assert.strictEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).buddy.frame, 5);
});

test('CLI: invalid stepSeconds steps every refresh', () => {
  const { stateDir, env } = cliEnv();
  const stateFile = path.join(stateDir, 'state.json');
  fs.writeFileSync(
    stateFile,
    JSON.stringify({ current: 'full', events: [], buddy: { stepSeconds: 'fast' } })
  );
  execFileSync('node', [SCRIPT], { env, input: '' });
  execFileSync('node', [SCRIPT], { env, input: '' });
  assert.strictEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).buddy.frame, 2);
});

test('CLI: milestone crossing stamps buddy.milestoneAt', () => {
  const { stateDir, env } = cliEnv();
  const transcript = path.join(stateDir, 'transcript.jsonl');
  // full factor is 0.26 → saved = tokens/(1-0.26) - tokens ≈ 0.351*tokens;
  // 20000 tokens ≈ 7027 saved → crosses the 5k milestone
  fs.writeFileSync(
    transcript,
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-07-08T10:00:00.000Z',
      message: { usage: { output_tokens: 20000 } },
    }) + '\n'
  );
  execFileSync('node', [SCRIPT], {
    env,
    input: JSON.stringify({ session_id: 'cli-mile', transcript_path: transcript }),
  });
  const state = JSON.parse(fs.readFileSync(path.join(stateDir, 'state.json'), 'utf8'));
  assert.ok(state.buddy.milestoneAt, 'milestoneAt stamped');
});
