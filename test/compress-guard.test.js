const test = require('node:test');
const assert = require('node:assert');
const { isSensitivePath, validateDraft } = require('../scripts/lib/compress-guard');

test('isSensitivePath refuses .env files', () => {
  assert.strictEqual(isSensitivePath('/Users/joao/project/.env').ok, false);
});

test('isSensitivePath refuses .pem files', () => {
  assert.strictEqual(isSensitivePath('keys/server.pem').ok, false);
});

test('isSensitivePath refuses id_rsa-style key filenames', () => {
  assert.strictEqual(isSensitivePath('/home/user/.ssh/id_rsa').ok, false);
  assert.strictEqual(isSensitivePath('id_ed25519').ok, false);
});

test('isSensitivePath refuses credentials/secret-prefixed filenames', () => {
  assert.strictEqual(isSensitivePath('config/credentials.json').ok, false);
  assert.strictEqual(isSensitivePath('secrets.yaml').ok, false);
});

test('isSensitivePath refuses paths inside .ssh, .aws, .gnupg', () => {
  assert.strictEqual(isSensitivePath('/home/user/.ssh/config').ok, false);
  assert.strictEqual(isSensitivePath('/home/user/.aws/credentials-backup').ok, false);
  assert.strictEqual(isSensitivePath('/home/user/.gnupg/pubring.kbx').ok, false);
});

test('isSensitivePath refuses filenames containing apikey or token', () => {
  assert.strictEqual(isSensitivePath('my-apikey.txt').ok, false);
  assert.strictEqual(isSensitivePath('slack-token.md').ok, false);
});

test('isSensitivePath allows a normal CLAUDE.md', () => {
  assert.strictEqual(isSensitivePath('./CLAUDE.md').ok, true);
  assert.strictEqual(isSensitivePath('docs/notes.md').ok, true);
});

test('validateDraft passes when structure is preserved', () => {
  const original =
    '# Title\n\nSome verbose text here explaining things at length.\n\n' +
    '## Section\n\n```bash\nnpm test\n```\n\nSee https://example.com/docs for more.\n';
  const draft =
    '# Title\n\nDense text.\n\n' +
    '## Section\n\n```bash\nnpm test\n```\n\nSee https://example.com/docs.\n';
  const result = validateDraft(original, draft);
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.reasons, []);
  assert.deepStrictEqual(result.summary.headings, [2, 2]);
  assert.deepStrictEqual(result.summary.codeBlocks, [1, 1]);
  assert.deepStrictEqual(result.summary.urls, [1, 1]);
});

test('validateDraft fails on an empty draft', () => {
  const result = validateDraft('# Title\n\ntext\n', '   \n');
  assert.strictEqual(result.ok, false);
  assert.ok(result.reasons.includes('draft is empty'));
  assert.strictEqual(result.summary, null);
});

test('validateDraft fails when draft is byte-identical to original', () => {
  const text = '# Title\n\nSame text.\n';
  const result = validateDraft(text, text);
  assert.strictEqual(result.ok, false);
  assert.ok(result.reasons.includes('draft is byte-identical to original'));
});

test('validateDraft fails when heading count changes', () => {
  const original = '# Title\n\n## Section A\n\n## Section B\n\ntext\n';
  const draft = '# Title\n\n## Section A\n\ntext\n';
  const result = validateDraft(original, draft);
  assert.strictEqual(result.ok, false);
  assert.ok(result.reasons.some((r) => r === 'heading count changed: original 3, draft 2'));
});

test('validateDraft ignores # lines inside code blocks when counting headings', () => {
  const text = '# Title\n\nProse.\n\n```bash\n# not a heading\nnpm test\n```\n';
  const result = validateDraft(text, text);
  assert.deepStrictEqual(result.summary.headings, [1, 1]);
});

test('validateDraft fails when a code block is altered', () => {
  const original = '# Title\n\n```bash\nnpm test\n```\n';
  const draft = '# Title\n\n```bash\nnpm run test\n```\n';
  const result = validateDraft(original, draft);
  assert.strictEqual(result.ok, false);
  assert.ok(
    result.reasons.includes(
      'code block dropped or altered: original block #1 not found unchanged in draft'
    )
  );
});

test('validateDraft fails when a url is dropped', () => {
  const original = '# Title\n\nSee https://example.com/docs and https://example.com/api.\n';
  const draft = '# Title\n\nSee https://example.com/docs.\n';
  const result = validateDraft(original, draft);
  assert.strictEqual(result.ok, false);
  assert.ok(result.reasons.includes('url dropped: https://example.com/api'));
});

test('validateDraft does not flag urls added in the draft', () => {
  const original = '# Title\n\ntext\n';
  const draft = '# Title\n\ntext, see https://example.com/new\n';
  const result = validateDraft(original, draft);
  assert.strictEqual(result.ok, true);
});
