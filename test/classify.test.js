const test = require('node:test');
const assert = require('node:assert');
const { classifyPrompt } = require('../scripts/lib/classify');

test('question detection', () => {
  assert.strictEqual(classifyPrompt('why does this re-render?'), 'question');
  assert.strictEqual(classifyPrompt('How do I deploy this'), 'question');
});

test('bugfix detection', () => {
  assert.strictEqual(classifyPrompt('fix the crash in login'), 'bugfix');
  assert.strictEqual(classifyPrompt('tests are broken on CI'), 'bugfix');
});

test('build detection', () => {
  assert.strictEqual(classifyPrompt('add a dark mode toggle'), 'build');
  assert.strictEqual(classifyPrompt('implement the parser'), 'build');
});

test('bugfix beats build when both match', () => {
  assert.strictEqual(classifyPrompt('add a fix for the error'), 'bugfix');
});

test('other fallback', () => {
  assert.strictEqual(classifyPrompt('thanks, looks great'), 'other');
});
