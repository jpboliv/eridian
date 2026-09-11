const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { score } = require('../scripts/lib/readcost');
const ROOT = path.join(__dirname, '..');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-diagnostics-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const transcript = path.join(dir, 'session.jsonl');
  fs.writeFileSync(transcript, '');
  const env = { ...process.env, ERIDIAN_STATE_DIR: dir };
  delete env.CLAUDE_SESSION_ID;
  const scan = (options = {}) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          '-e',
          'console.log(JSON.stringify(require("./scripts/lib/session-diagnostics").sessionDiagnostics(JSON.parse(process.argv[1]))))',
          JSON.stringify({
            sessionId: 'current',
            transcriptPath: transcript,
            language: 'en',
            ...options,
          }),
        ],
        { cwd: ROOT, env, encoding: 'utf8' }
      )
    );
  const append = (value) =>
    fs.appendFileSync(transcript, typeof value === 'string' ? value : JSON.stringify(value) + '\n');
  const stats = (args = []) =>
    execFileSync(process.execPath, ['scripts/stats.js', ...args], {
      cwd: ROOT,
      env,
      encoding: 'utf8',
    });
  return { dir, transcript, scan, append, stats };
}
function reply(id, text, tokens = 10, content) {
  return {
    type: 'assistant',
    sessionId: 'current',
    message: {
      id,
      model: 'test',
      usage: { output_tokens: tokens },
      content: content || [{ type: 'text', text }],
    },
  };
}

test('stream snapshots and duplicates count once, weighted denominator uses raw sums', (t) => {
  const f = fixture(t);
  f.append(reply('a', 'Great question.', 2));
  f.append(reply('a', 'Great question. Run tests before deployment.', 12));
  f.append(reply('a', 'Great question.', 2));
  const long = 'Check deployment settings carefully. '.repeat(20);
  f.append(reply('b', long, 80));
  f.append(reply('b', long, 80));
  const r = f.scan();
  const a = score('Great question. Run tests before deployment.'),
    b = score(long);
  assert.equal(r.includedReplies, 2);
  assert.equal(r.proseWords, a.proseWords + b.proseWords);
  assert.equal(r.phraseMatches, a.phraseMatches + b.phraseMatches);
  assert.equal(r.phraseMatchRatePer100ProseWords, (100 * r.phraseMatches) / r.proseWords);
  assert.notEqual(
    r.phraseMatchRatePer100ProseWords,
    (a.phraseMatchRatePer100ProseWords + b.phraseMatchRatePer100ProseWords) / 2
  );
  assert.equal(f.scan().bytesRead, 0);
});

test('excludes tool, thinking, quoted code/artifacts, missing identity and wrong session', (t) => {
  const f = fixture(t);
  f.append({ type: 'user', message: { content: 'Great question.' } });
  f.append(
    reply('tool', '', 10, [
      { type: 'tool_use', input: { command: 'Great question.' } },
      { type: 'thinking', thinking: 'Great question.' },
    ])
  );
  f.append(
    reply('mixed', '', 30, [
      { type: 'thinking', thinking: 'Great question.' },
      { type: 'artifact', text: 'Great question.' },
      { type: 'text', text: 'Run tests.\n> Great question.\n```\nGreat question.\n```' },
    ])
  );
  f.append(reply('code', '```\nGreat question.\n```'));
  const missing = reply(undefined, 'Great question.');
  f.append(missing);
  f.append(missing);
  f.append({ ...reply('foreign', 'Great question.'), sessionId: 'other' });
  const r = f.scan();
  assert.equal(r.includedReplies, 1);
  assert.equal(r.excludedNonProseReplies, 2);
  assert.equal(r.unidentifiedRecords, 1);
  assert.equal(r.excludedSessionRecords, 1);
  assert.equal(r.phraseMatches, 0);
  assert.equal(r.proseWords, 2);
});

test('incremental cache preserves partial UTF-8 lines and only reads appended bytes', (t) => {
  const f = fixture(t);
  const line = Buffer.from(JSON.stringify(reply('unicode', 'Olá amigo.')) + '\n');
  const cut = line.indexOf(Buffer.from('á')) + 1;
  fs.appendFileSync(f.transcript, line.subarray(0, cut));
  const first = f.scan();
  assert.equal(first.includedReplies, 0);
  assert.equal(first.pendingBytes, cut);
  fs.appendFileSync(f.transcript, line.subarray(cut));
  const next = f.scan();
  assert.equal(next.includedReplies, 1);
  assert.equal(next.proseWords, 2);
  assert.equal(next.bytesRead, line.length - cut);
  assert.equal(next.rebuilt, false);
  assert.equal(next.pendingBytes, 0);
});

test('replacement/truncation, scorer changes and invalid cache rebuild without retaining stale rows', (t) => {
  const f = fixture(t);
  f.append(reply('old', 'Great question.'));
  f.scan();
  fs.writeFileSync(f.transcript, JSON.stringify(reply('new', 'Run.')) + '\n');
  let r = f.scan();
  assert.equal(r.rebuilt, true);
  assert.equal(r.phraseMatches, 0);
  assert.equal(r.includedReplies, 1);
  const replacement = f.transcript + '.new';
  fs.writeFileSync(replacement, JSON.stringify(reply('replacement', 'Check now.')) + '\n');
  fs.renameSync(replacement, f.transcript);
  assert.equal(f.scan().rebuilt, true);
  const cacheFile = path.join(f.dir, 'diagnostics/current.json');
  const cache = JSON.parse(fs.readFileSync(cacheFile));
  cache.scorerVersion = -1;
  fs.writeFileSync(cacheFile, JSON.stringify(cache));
  assert.equal(f.scan().rebuilt, true);
  const corrupt = JSON.parse(fs.readFileSync(cacheFile));
  delete corrupt.headHash;
  fs.writeFileSync(cacheFile, JSON.stringify(corrupt));
  assert.equal(f.scan().rebuilt, true);
  fs.writeFileSync(cacheFile, 'bad json');
  assert.equal(f.scan().rebuilt, true);
  r = f.scan({ language: 'pt' });
  assert.equal(r.rebuilt, true);
  assert.equal(r.lexicalSupported, false);
  assert.equal(r.phraseMatches, null);
  assert.equal(r.phraseMatchRatePer100ProseWords, null);
  assert.equal(r.counts.filler, null);
});

test('optional stats require caller identity and label unsupported language without selecting newest cache', (t) => {
  const f = fixture(t);
  f.append(reply('one', 'Great question.'));
  assert.doesNotMatch(f.stats(), /Optional style diagnostics/);
  assert.match(
    f.stats(['--diagnostics', '--transcript', f.transcript]),
    /unavailable \(requires current session ID/
  );
  const out = f.stats(['--diagnostics', '--session-id', 'current', '--transcript', f.transcript]);
  assert.match(out, /language: und; lexical dictionary: unsupported \(not zero\)/);
  assert.match(out, /included replies: 1/);
  assert.match(out, /not quality or reading time/);
  assert.equal(f.scan({ sessionId: null }), null);
});

test('oversized records are skipped without losing subsequent complete replies', (t) => {
  const f = fixture(t);
  f.append('x'.repeat(1024 * 1024 + 10));
  assert.equal(f.scan().oversizedRecords, 1);
  f.append('\n');
  f.append(reply('after', 'Run tests.'));
  const r = f.scan();
  assert.equal(r.oversizedRecords, 1);
  assert.equal(r.includedReplies, 1);
});
