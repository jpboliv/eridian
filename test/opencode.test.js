const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHooks } = require('../scripts/opencode/runtime');
const { install } = require('../scripts/opencode/install');
const { loadInjectionBlock } = require('../scripts/lib/persona');
const { loadWorkflow } = require('../scripts/lib/workflows');

async function fixture(t, extra = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-opencode-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { ERIDIAN_STATE_DIR: path.join(root, 'state'), XDG_CONFIG_HOME: root, ...extra };
  const diagnostics = [];
  const options = {
    directory: root,
    home: root,
    env,
    diagnostic: (message) => diagnostics.push(message),
  };
  const hooks = createHooks(options);
  const config = {};
  await hooks.config(config);
  const mode = async (arg, id = 'ses_one', target = hooks) => {
    const parts = [{ type: 'text', text: 'placeholder' }];
    await target['command.execute.before'](
      { command: 'eridian-mode', arguments: arg, sessionID: id },
      { parts }
    );
    return parts[0].text;
  };
  const system = async (id = 'ses_one', target = hooks) => {
    const output = { system: ['Host instructions'] };
    await target['experimental.chat.system.transform']({ sessionID: id }, output);
    return output.system;
  };
  return {
    root,
    env,
    options,
    hooks,
    config,
    diagnostics,
    mode,
    system,
    stateFile: path.join(root, 'state/opencode/state.json'),
  };
}

test('OpenCode exports a loadable plugin and registers commands without replacing user commands', async (t) => {
  const { EridianPlugin } = await import('../adapters/opencode/plugin.mjs');
  assert.equal(typeof EridianPlugin, 'function');
  const f = await fixture(t);
  assert.equal(Object.keys(f.config.command).length, 4);
  for (const name of ['commit', 'review'])
    assert.ok(f.config.command[`eridian-${name}`].template.includes(loadWorkflow(name)));
  const hooks = await EridianPlugin({ directory: f.root });
  const custom = { template: 'Custom command' };
  const config = { command: { 'eridian-mode': custom } };
  await hooks.config(config);
  assert.equal(config.command['eridian-mode'], custom);
  const parts = [{ type: 'text', text: 'untouched' }];
  await hooks['command.execute.before'](
    { command: 'eridian-mode', arguments: 'full', sessionID: 'ses_one' },
    { parts }
  );
  assert.equal(parts[0].text, 'untouched');
});

test('mode changes use shared rules, persist across reloads, and isolate existing sessions', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(await f.system(), ['Host instructions']);
  await f.system('ses_other');
  assert.match(await f.mode('full'), /mode: full/);
  assert.equal(
    (await f.system())[1],
    `Eridian mode "full" is active.\n${loadInjectionBlock('full')}`
  );
  assert.equal((await f.system('ses_other')).length, 1);
  assert.equal((await f.system('ses_new')).length, 2);
  const reloaded = createHooks(f.options);
  assert.deepEqual(await f.system('ses_one', reloaded), await f.system());
  assert.match(await f.mode(''), /mode: off/);
  assert.equal((await f.system()).length, 1);
  assert.match(await f.mode('eridian'), /mode: ultra/);
  assert.match(await f.mode('status'), /current: ultra/);
});

test('team defaults and reset retain precedence without changing other sessions', async (t) => {
  const f = await fixture(t);
  fs.writeFileSync(path.join(f.root, '.eridian.json'), '{"defaultMode":"lite"}');
  assert.match((await f.system())[1], /mode "lite"/);
  await f.mode('off');
  assert.equal((await f.system()).length, 1);
  assert.match(await f.mode('reset'), /mode: lite/);
  f.env.ERIDIAN_DEFAULT_MODE = 'ultra';
  assert.match(await f.mode('reset'), /mode: ultra/);
  assert.equal(JSON.parse(fs.readFileSync(f.stateFile)).preferences.current, 'off');
});

test('opt-out bypasses all state access, including corrupt future-schema state', async (t) => {
  const f = await fixture(t, { ERIDIAN_OFF: '1', ERIDIAN_DEFAULT_MODE: 'full' });
  assert.match(await f.mode('full'), /disabled/);
  assert.equal((await f.system()).length, 1);
  assert.equal(fs.existsSync(f.stateFile), false);
  fs.mkdirSync(path.dirname(f.stateFile), { recursive: true });
  fs.writeFileSync(f.stateFile, '{"version":999}');
  assert.match(await f.mode('reset'), /disabled/);
  assert.equal((await f.system()).length, 1);
  assert.equal(fs.readFileSync(f.stateFile, 'utf8'), '{"version":999}');
});

test('invalid identity and arguments cannot save preferences; payload is not duplicated', async (t) => {
  const f = await fixture(t);
  assert.match(await f.mode('full', '__proto__'), /invalid/);
  assert.match(await f.mode('full; echo unsafe'), /Unknown/);
  for (const arg of ['constructor', '__proto__']) assert.match(await f.mode(arg), /Unknown/);
  assert.equal((await f.system(null)).length, 1);
  assert.equal(fs.existsSync(f.stateFile), false);
  await f.mode('lite');
  const before = fs.readFileSync(f.stateFile, 'utf8');
  for (const arg of ['constructor', '__proto__']) {
    assert.match(await f.mode(arg), /Unknown/);
    assert.equal(fs.readFileSync(f.stateFile, 'utf8'), before);
  }
  const output = { system: [] };
  for (let i = 0; i < 2; i++)
    await f.hooks['experimental.chat.system.transform']({ sessionID: 'ses_one' }, output);
  assert.equal(output.system.length, 1);
  assert.deepEqual(fs.readdirSync(path.join(f.root, 'state')), ['opencode']);
});

test('future-schema state cannot abort requests, misreport success, or get overwritten', async (t) => {
  const f = await fixture(t, { ERIDIAN_DEFAULT_MODE: 'full' });
  fs.mkdirSync(path.dirname(f.stateFile), { recursive: true });
  const future = '{"version":999}';
  fs.writeFileSync(f.stateFile, future);
  for (let i = 0; i < 2; i++) assert.deepEqual(await f.system(), ['Host instructions']);
  assert.equal(f.diagnostics.length, 1);
  assert.match(f.diagnostics[0], /style injection unavailable: Unsupported Eridian state schema/);
  for (const arg of ['full', 'status', 'reset'])
    assert.match(await f.mode(arg), /mode command failed: Unsupported Eridian state schema/);
  assert.equal(fs.readFileSync(f.stateFile, 'utf8'), future);

  fs.unlinkSync(f.stateFile);
  assert.match((await f.system())[1], /mode "full"/);
  fs.writeFileSync(f.stateFile, future);
  assert.deepEqual(await f.system(), ['Host instructions']);
  assert.equal(f.diagnostics.length, 2);

  const failingLogger = createHooks({
    ...f.options,
    diagnostic: () => {
      throw new Error('logger failed');
    },
  });
  assert.deepEqual(await f.system('ses_one', failingLogger), ['Host instructions']);
});

test('state directory creation failures preserve host requests and recover after repair', async (t) => {
  const f = await fixture(t);
  fs.mkdirSync(f.env.ERIDIAN_STATE_DIR, { recursive: true });
  const blocked = path.dirname(f.stateFile);
  fs.writeFileSync(blocked, 'existing file');
  assert.deepEqual(await f.system(), ['Host instructions']);
  assert.match(await f.mode('full'), /mode command failed:/);
  assert.equal(fs.readFileSync(blocked, 'utf8'), 'existing file');
  fs.unlinkSync(blocked);
  assert.match(await f.mode('full'), /Eridian mode: full/);
  assert.match((await f.system())[1], /mode "full"/);
});

test('lock timeouts cannot abort requests or claim a mode change, and retain the lock', async (t) => {
  const f = await fixture(t);
  await f.mode('full');
  const before = fs.readFileSync(f.stateFile, 'utf8');
  const lock = `${f.stateFile}.lock`;
  fs.mkdirSync(lock);
  assert.deepEqual(await f.system('ses_new'), ['Host instructions']);
  assert.match(await f.mode('off'), /mode command failed: Eridian state lock timed out/);
  assert.equal(fs.readFileSync(f.stateFile, 'utf8'), before);
  assert.ok(fs.statSync(lock).isDirectory());
  assert.match((await f.system())[1], /mode "full"/);
  fs.rmdirSync(lock);
  assert.match(await f.mode('off'), /Eridian mode: off/);
  assert.deepEqual(await f.system(), ['Host instructions']);
});

test('loader installs idempotently and refuses to overwrite existing files or symlinks', async (t) => {
  const f = await fixture(t);
  const target = path.join(f.root, 'project with spaces/.opencode');
  const file = install(target);
  assert.equal(install(target), file);
  assert.match(fs.readFileSync(file, 'utf8'), /export \{ EridianPlugin \} from "file:/);
  fs.writeFileSync(file, '// user plugin');
  assert.throws(() => install(target), /Refusing/);
  assert.equal(fs.readFileSync(file, 'utf8'), '// user plugin');
  fs.unlinkSync(file);
  fs.symlinkSync(path.join(f.root, 'missing'), file);
  assert.throws(() => install(target), /Refusing/);
});
