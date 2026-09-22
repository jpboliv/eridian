const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const {
  loadInjectionBlock,
  loadReminderBlock,
  extractInjectionBlock,
  SKILL_FILE,
} = require('../scripts/lib/persona');
const root = path.resolve(__dirname, '..');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-cadence-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = {
    ...process.env,
    ERIDIAN_STATE_DIR: dir,
    ERIDIAN_OFF: '0',
    CLAUDE_SESSION_ID: 'alpha',
  };
  const run = (script, args = [], input = {}) =>
    execFileSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
      env,
      input: JSON.stringify({ session_id: 'alpha', ...input }),
      encoding: 'utf8',
    });
  return { dir, env, run };
}
function prime(dir, id, count) {
  const file = path.join(dir, 'state.json');
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  state.sessions[id].promptsSinceReinject = count;
  fs.writeFileSync(file, JSON.stringify(state));
}
test('experimental reminders load exactly one marked source region per level', () => {
  const md = fs.readFileSync(SKILL_FILE, 'utf8');
  for (const level of ['lite', 'full', 'ultra'])
    assert.equal(loadReminderBlock(level), extractInjectionBlock(md, `reminder-${level}`));
  assert.equal(loadReminderBlock('off'), null);
  assert.equal(loadReminderBlock('unknown'), null);
});
for (const level of ['lite', 'full', 'ultra']) {
  test(`${level}: full reminder fires at 20, resets, and off suppresses pending refresh`, (t) => {
    const f = fixture(t);
    f.run('mode.js', [level]);
    prime(f.dir, 'alpha', 18);
    assert.equal(f.run('buddy-hook.js', ['prompt']), '');
    assert.ok(f.run('buddy-hook.js', ['prompt']).endsWith(loadInjectionBlock(level)));
    assert.equal(f.run('buddy-hook.js', ['prompt']), '');
    prime(f.dir, 'alpha', 19);
    f.run('mode.js', ['off']);
    assert.equal(f.run('buddy-hook.js', ['prompt']), '');
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(f.dir, 'state.json'))).sessions.alpha
        .promptsSinceReinject,
      0
    );
  });
}
test('startup, resume, compaction and explicit mode changes reset only the caller counter', (t) => {
  const f = fixture(t);
  f.run('mode.js', ['full']);
  f.run('mode.js', ['lite', '--session-id', 'beta']);
  for (const source of ['startup', 'resume', 'compact']) {
    prime(f.dir, 'alpha', 19);
    prime(f.dir, 'beta', 7);
    assert.ok(
      JSON.parse(
        f.run('session-start.js', [], { source })
      ).hookSpecificOutput.additionalContext.includes(loadInjectionBlock('full'))
    );
    assert.equal(f.run('buddy-hook.js', ['prompt']), '');
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(f.dir, 'state.json'))).sessions.beta
        .promptsSinceReinject,
      7
    );
  }
  prime(f.dir, 'alpha', 19);
  f.run('mode.js', ['ultra']);
  assert.equal(f.run('buddy-hook.js', ['prompt']), '');
});
test('post-commit reminder effects serialize before concurrent disabling', async (t) => {
  const f = fixture(t);
  f.run('mode.js', ['full']);
  const ready = path.join(f.dir, 'ready');
  const log = path.join(f.dir, 'order');
  const start = (source) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', source], { cwd: root, env: f.env });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    });
  const reminder = start(
    `const fs=require('node:fs'); const {updateSession}=require('./scripts/lib/state'); updateSession('alpha',s=>s,{afterCommit:()=>{fs.writeFileSync(${JSON.stringify(ready)},'ready');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,200);fs.appendFileSync(${JSON.stringify(log)},'reminder\\n');}});`
  );
  const deadline = Date.now() + 3000;
  while (!fs.existsSync(ready) && Date.now() < deadline) await delay(10);
  assert.ok(fs.existsSync(ready));
  const off = start(
    `const fs=require('node:fs');const {updateSession}=require('./scripts/lib/state');updateSession('alpha',s=>({...s,current:'off'}),{afterCommit:()=>fs.appendFileSync(${JSON.stringify(log)},'off\\n')});`
  );
  await Promise.all([reminder, off]);
  assert.equal(fs.readFileSync(log, 'utf8'), 'reminder\noff\n');
  assert.equal(f.run('buddy-hook.js', ['prompt']), '');
});

for (const script of ['session-start.js', 'mode.js']) {
  test(`${script}: activation is emitted before a following off transaction`, (t) => {
    const f = fixture(t);
    f.run('mode.js', ['full']);
    const log = path.join(f.dir, 'activation-order');
    // Disable at the first opportunity after updateSession releases its lock.
    // An activation printed after that point would restore stale instructions.
    const source = `
      const fs = require('node:fs');
      const { execFileSync } = require('node:child_process');
      const state = require('./scripts/lib/state');
      const original = state.updateSession;
      const log = ${JSON.stringify(log)};
      const record = text => {
        if (String(text).includes('ROCKY MODE')) fs.appendFileSync(log, 'activation\\n');
      };
      const write = fs.writeSync;
      fs.writeSync = (fd, text, ...args) => {
        if (fd === 1) record(text);
        return write(fd, text, ...args);
      };
      const stdout = process.stdout.write.bind(process.stdout);
      process.stdout.write = (text, ...args) => { record(text); return stdout(text, ...args); };
      state.updateSession = (...args) => {
        const result = original(...args);
        execFileSync(process.execPath, ['scripts/mode.js', 'off'], { env: process.env });
        fs.appendFileSync(log, 'off\\n');
        return result;
      };
      process.argv = [process.execPath, 'scripts/${script}', 'full'];
      require('./scripts/${script}');
    `;
    execFileSync(process.execPath, ['-e', source], {
      cwd: root,
      env: f.env,
      input: JSON.stringify({ session_id: 'alpha', source: 'resume' }),
    });
    assert.equal(fs.readFileSync(log, 'utf8'), 'activation\noff\n');
    assert.equal(f.run('buddy-hook.js', ['prompt']), '');
  });
}
