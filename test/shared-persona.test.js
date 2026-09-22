require('./helpers/env').isolateEnv();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractInjectionBlock,
  composeInjectionBlock,
  loadInjectionBlock,
  SKILL_FILE,
} = require('../scripts/lib/persona');
const root = path.resolve(__dirname, '..');
const region = (name, text) =>
  `<!-- eridian:inject:${name} -->\n${text}\n<!-- /eridian:inject:${name} -->`;

test('composition includes exactly one shared region then the requested level', () => {
  const markdown = region('shared', 'SHARED') + '\n' + region('full', 'FULL');
  assert.equal(extractInjectionBlock(markdown, 'shared'), 'SHARED');
  assert.equal(composeInjectionBlock(markdown, 'full'), 'SHARED\n\nFULL');
  assert.equal(composeInjectionBlock(markdown, 'lite'), null);
  assert.equal(composeInjectionBlock(markdown, 'off'), null);
  assert.equal(composeInjectionBlock(markdown, 'shared'), null);
});

test('missing, empty and duplicate shared regions cannot emit an unprotected dialect', () => {
  const full = region('full', 'FULL');
  assert.equal(composeInjectionBlock(full, 'full'), null);
  assert.equal(composeInjectionBlock(region('shared', '') + full, 'full'), null);
  assert.equal(
    composeInjectionBlock(region('shared', 'A') + region('shared', 'B') + full, 'full'),
    null
  );
  assert.equal(composeInjectionBlock(region('shared', 'A') + full + full, 'full'), null);
});

test('real skill composes its single shared block into every active level', () => {
  const markdown = fs.readFileSync(SKILL_FILE, 'utf8');
  assert.equal(markdown.split('<!-- eridian:inject:shared -->').length - 1, 1);
  const shared = extractInjectionBlock(markdown, 'shared');
  // Behavioral acceptance uses captured replies, not matches against prompt wording.
  assert.ok(shared.trim());
  for (const level of ['lite', 'full', 'ultra'])
    assert.equal(
      loadInjectionBlock(level),
      shared + '\n\n' + extractInjectionBlock(markdown, level)
    );
  assert.ok(!loadInjectionBlock('lite').includes('Cut all'));
});

for (const level of ['lite', 'full', 'ultra']) {
  test(`${level}: mode, startup/resume/compaction, full reinjection and eval emit identical payload`, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-shared-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const env = {
      ...process.env,
      ERIDIAN_STATE_DIR: dir,
      ERIDIAN_OFF: '0',
      CLAUDE_SESSION_ID: 'shared-session',
    };
    const run = (script, args = [], input = {}) =>
      execFileSync(process.execPath, [path.join(root, script), ...args], {
        env,
        input: JSON.stringify({ session_id: 'shared-session', ...input }),
        encoding: 'utf8',
      });
    const payload = loadInjectionBlock(level);
    assert.equal(run('scripts/mode.js', [level]), `eridian mode: ${level}\n\n${payload}\n`);
    for (const source of ['startup', 'resume', 'compact']) {
      const output = JSON.parse(run('scripts/session-start.js', [], { source }));
      assert.equal(
        output.hookSpecificOutput.additionalContext,
        `Eridian mode "${level}" is active (persisted). Apply these style rules to all responses:\n\n${payload}`
      );
    }
    const stateFile = path.join(dir, 'state.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    state.sessions['shared-session'].promptsSinceReinject = 19;
    fs.writeFileSync(stateFile, JSON.stringify(state));
    assert.equal(
      run('scripts/buddy-hook.js', ['prompt'], { prompt: 'Explain this' }),
      `Eridian mode "${level}" reminder (long session — re-asserting style):\n\n${payload}`
    );
    assert.equal(run('eval/prefix.js', [level]), payload);
  });
}
