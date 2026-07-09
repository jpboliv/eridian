const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.ERIDIAN_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-ss-'));

const test = require('node:test');
const assert = require('node:assert');
const {
  sessionSavings,
  latestSessionSaved,
  SESSIONS_DIR,
} = require('../scripts/lib/session-savings');

const T0 = Date.parse('2026-07-08T10:00:00Z');
const mins = (n) => T0 + n * 60_000;
const iso = (ms) => new Date(ms).toISOString();
const FACTORS = { full: 0.5, ultra: 0.9 };

// state with full mode active since T0 (session will start inside the window)
const stateOn = { current: 'full', events: [{ ts: iso(mins(0)), level: 'full' }], buddy: {} };

let seq = 0;
function tmpTranscript(lines) {
  const p = path.join(process.env.ERIDIAN_STATE_DIR, `transcript-${seq++}.jsonl`);
  fs.writeFileSync(p, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return p;
}

function assistant(atMin, tokens) {
  return {
    type: 'assistant',
    timestamp: iso(mins(atMin)),
    message: { usage: { output_tokens: tokens } },
  };
}

function cachePath(id) {
  return path.join(SESSIONS_DIR, `${id}.json`);
}

test('computes savings for messages inside an active window', () => {
  const tp = tmpTranscript([assistant(5, 100)]);
  const r = sessionSavings(
    { sessionId: 's-basic', transcriptPath: tp },
    stateOn,
    FACTORS,
    mins(10)
  );
  // 100/(1-0.5) - 100 = 100
  assert.strictEqual(r.savedTokens, 100);
});

test('incremental: second call reads only appended bytes and accumulates', () => {
  const tp = tmpTranscript([assistant(5, 100)]);
  const id = 's-incr';
  sessionSavings({ sessionId: id, transcriptPath: tp }, stateOn, FACTORS, mins(10));
  const offsetAfterFirst = JSON.parse(fs.readFileSync(cachePath(id), 'utf8')).offset;
  assert.strictEqual(offsetAfterFirst, fs.statSync(tp).size);

  fs.appendFileSync(tp, JSON.stringify(assistant(6, 100)) + '\n');
  const r = sessionSavings({ sessionId: id, transcriptPath: tp }, stateOn, FACTORS, mins(10));
  assert.strictEqual(r.savedTokens, 200);
  assert.strictEqual(
    JSON.parse(fs.readFileSync(cachePath(id), 'utf8')).offset,
    fs.statSync(tp).size
  );
});

test('partial trailing line is not consumed until its newline arrives', () => {
  const tp = tmpTranscript([assistant(5, 100)]);
  const id = 's-partial';
  const half = JSON.stringify(assistant(6, 100));
  fs.appendFileSync(tp, half.slice(0, 20)); // no newline, malformed tail
  const r1 = sessionSavings({ sessionId: id, transcriptPath: tp }, stateOn, FACTORS, mins(10));
  assert.strictEqual(r1.savedTokens, 100);

  fs.appendFileSync(tp, half.slice(20) + '\n');
  const r2 = sessionSavings({ sessionId: id, transcriptPath: tp }, stateOn, FACTORS, mins(10));
  assert.strictEqual(r2.savedTokens, 200);
});

test('messages outside any mode window do not count', () => {
  // window opens at min 10; message at min 5 is before it, session start too
  const stateLate = { current: 'full', events: [{ ts: iso(mins(10)), level: 'full' }], buddy: {} };
  const tp = tmpTranscript([assistant(5, 100)]);
  const r = sessionSavings(
    { sessionId: 's-window', transcriptPath: tp },
    stateLate,
    FACTORS,
    mins(20)
  );
  assert.strictEqual(r.savedTokens, 0);
});

test('session started before mode-on: nothing counts (persona never injected)', () => {
  const stateLate = { current: 'full', events: [{ ts: iso(mins(10)), level: 'full' }], buddy: {} };
  // session starts at min 5 (first line), message at min 15 inside the window
  const tp = tmpTranscript([assistant(5, 10), assistant(15, 100)]);
  const r = sessionSavings(
    { sessionId: 's-gate', transcriptPath: tp },
    stateLate,
    FACTORS,
    mins(20)
  );
  assert.strictEqual(r.savedTokens, 0);
});

test('truncated/replaced transcript resets the cache and rescans', () => {
  const tp = tmpTranscript([assistant(5, 100), assistant(6, 100)]);
  const id = 's-trunc';
  sessionSavings({ sessionId: id, transcriptPath: tp }, stateOn, FACTORS, mins(10));
  fs.writeFileSync(tp, JSON.stringify(assistant(7, 50)) + '\n'); // smaller file
  const r = sessionSavings({ sessionId: id, transcriptPath: tp }, stateOn, FACTORS, mins(10));
  assert.strictEqual(r.savedTokens, 50);
});

test('milestones: crossed once, never re-reported', () => {
  const tp = tmpTranscript([assistant(5, 6000)]); // saved = 6000 with factor 0.5
  const id = 's-mile';
  const r1 = sessionSavings({ sessionId: id, transcriptPath: tp }, stateOn, FACTORS, mins(10));
  assert.deepStrictEqual(r1.crossed, [5_000]);
  const r2 = sessionSavings({ sessionId: id, transcriptPath: tp }, stateOn, FACTORS, mins(10));
  assert.deepStrictEqual(r2.crossed, []);
});

test('returns null for missing transcript or unsafe session id', () => {
  assert.strictEqual(
    sessionSavings(
      { sessionId: 's-x', transcriptPath: '/nope/missing.jsonl' },
      stateOn,
      FACTORS,
      mins(1)
    ),
    null
  );
  const tp = tmpTranscript([assistant(5, 10)]);
  assert.strictEqual(
    sessionSavings({ sessionId: '../evil', transcriptPath: tp }, stateOn, FACTORS, mins(1)),
    null
  );
  assert.strictEqual(
    sessionSavings({ sessionId: null, transcriptPath: tp }, stateOn, FACTORS, mins(1)),
    null
  );
});

test('corrupt cache file is reset, not fatal', () => {
  const tp = tmpTranscript([assistant(5, 100)]);
  const id = 's-corrupt';
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.writeFileSync(cachePath(id), '{not json!!');
  const r = sessionSavings({ sessionId: id, transcriptPath: tp }, stateOn, FACTORS, mins(10));
  assert.strictEqual(r.savedTokens, 100);
});

test('prunes session caches older than 30 days', () => {
  const tp = tmpTranscript([assistant(5, 100)]);
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  const old = cachePath('s-ancient');
  fs.writeFileSync(old, '{}');
  const past = new Date(mins(0) - 31 * 24 * 60 * 60 * 1000);
  fs.utimesSync(old, past, past);
  sessionSavings({ sessionId: 's-prune', transcriptPath: tp }, stateOn, FACTORS, mins(10));
  assert.ok(!fs.existsSync(old), 'stale cache pruned');
});

test('latestSessionSaved returns newest cache savedTokens', () => {
  const tpA = tmpTranscript([assistant(5, 100)]);
  const tpB = tmpTranscript([assistant(5, 200)]);
  sessionSavings({ sessionId: 's-old', transcriptPath: tpA }, stateOn, FACTORS, mins(10));
  const past = new Date(mins(0) - 60_000);
  fs.utimesSync(cachePath('s-old'), past, past);
  sessionSavings({ sessionId: 's-new', transcriptPath: tpB }, stateOn, FACTORS, mins(10));
  assert.strictEqual(latestSessionSaved(), 200);
});
