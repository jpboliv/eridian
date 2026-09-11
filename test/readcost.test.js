const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { score } = require('../scripts/lib/readcost');

test('clean prose and ambiguous fragments are observations, not quality ratings', () => {
  assert.equal(score('Restart the server.').proseWords, 3);
  assert.equal(score('Restart the server.').sentences, 1);
  assert.equal(score('Yes').phraseMatches, 0);
  assert.equal(score('Yes').sentences, 1);
  assert.equal(score('').phraseMatchRatePer100ProseWords, null);
});

test('lexical categories and rate are deterministic', () => {
  const text = "Great question. It's worth noting this game changer. In summary, good good good. ♫";
  const result = score(text);
  assert.deepEqual(result, score(text));
  for (const category of ['filler', 'preambles', 'recaps', 'salesLanguage'])
    assert.equal(result.counts[category], 1);
  assert.equal(result.counts.rockyMarkers, 2);
  assert.equal(result.phraseMatches, 4);
  assert.equal(result.phraseMatchRatePer100ProseWords, 400 / result.proseWords);
});

test('matching handles case, Unicode boundaries, apostrophes, and whitespace', () => {
  assert.equal(score('GREAT  QUESTION! It’s worth noting.').phraseMatches, 2);
  assert.equal(score('great questionnaire égreat question great questioné').phraseMatches, 0);
  assert.equal(score('great question great question').phraseMatches, 2);
});

test('uncertainty and other senses of just are not filler', () => {
  assert.equal(
    score(
      'This may fail. I am uncertain. Perhaps retry. I just arrived. A just decision. Just use the flag.'
    ).phraseMatches,
    0
  );
});

test('requested structure and Rocky observations do not contribute to rate', () => {
  const result = score(
    '# Results\n- **Status:** ready\n- ✅ done\n| Key | Value |\n| --- | --- |\n| a | b |\nGood good good.'
  );
  assert.equal(result.counts.headers, 1);
  assert.equal(result.counts.boldLabelBullets, 1);
  assert.equal(result.counts.emojiBullets, 1);
  assert.equal(result.counts.tables, 1);
  assert.equal(result.counts.rockyMarkers, 1);
  assert.equal(result.phraseMatches, 0);
});

test('quoted prose and code are excluded from counts and rate denominator', () => {
  const text =
    '> great question\n"great question" “great question” «great question» \'great question\' ‘great question’\n`great question`\n~~~js\ngreat question\n~~~\n````\n```\ngreat question\n````\nShip now.';
  const result = score(text);
  assert.equal(result.phraseMatches, 0);
  assert.equal(result.proseWords, 2);
  assert.equal(score('```\ngreat question').proseWords, 0);
  assert.equal(score('`great question`').phraseMatchRatePer100ProseWords, null);
  assert.equal(score('``great ` question``').proseWords, 0);
  assert.equal(score('    great question\n\tgreat question').proseWords, 0);
  assert.equal(score('`great question``').phraseMatches, 1);
  assert.equal(score("'it's worth noting' and ‘it’s worth noting’").phraseMatches, 0);
  assert.equal(score('"great\nquestion"').proseWords, 0);
  assert.equal(score('good good good good good good').counts.rockyMarkers, 2);
});

test('unsupported languages keep structure and report null lexical counts', () => {
  const result = score('# Resultado\nTalvez seja útil.', { language: 'pt-PT' });
  assert.equal(result.lexicalSupported, false);
  assert.equal(result.counts.headers, 1);
  assert.equal(result.proseWords, 4);
  assert.equal(result.counts.filler, null);
  assert.equal(result.phraseMatches, null);
  assert.equal(result.phraseMatchRatePer100ProseWords, null);
  assert.equal(score('great question', { language: 'en-GB' }).lexicalSupported, true);
});

test('long sentence threshold and input validation', () => {
  assert.equal(score(`${'word '.repeat(31)}.`).longSentences, 1);
  assert.equal(score(`${'word '.repeat(30)}.`).longSentences, 0);
  assert.throws(() => score(null), TypeError);
  assert.throws(() => score('text', { language: '' }), TypeError);
});

test('CLI supports stdin, files, language, and actionable errors', () => {
  const cli = path.join(__dirname, '../scripts/readcost.js');
  const run = (args, input) =>
    spawnSync(process.execPath, [cli, ...args], { input, encoding: 'utf8' });
  assert.equal(JSON.parse(run([], 'great question').stdout).phraseMatches, 1);
  assert.equal(JSON.parse(run(['--language', 'pt', '-'], '# Olá').stdout).lexicalSupported, false);
  assert.equal(JSON.parse(run([__filename]).stdout).label, 'style diagnostics');
  assert.equal(run(['--language']).status, 1);
  assert.match(run(['/nonexistent/eridian/readcost.txt']).stderr, /style diagnostics:/);
  assert.equal(run(['a', 'b']).status, 1);
});
