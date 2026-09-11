#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { setTimeout, clearTimeout } = require('node:timers');
const { spawn, execFileSync } = require('node:child_process');
const { ARMS, hash, validateResult, summarize, anonymize } = require('./lib');
const { loadInjectionBlock, SKILL_FILE } = require('../scripts/lib/persona');
const { score } = require('../scripts/lib/readcost');

async function run(options = {}) {
  const root = path.join(__dirname, '..');
  const promptFile = options.prompts || path.join(__dirname, 'cases.json');
  const prompts = JSON.parse(fs.readFileSync(promptFile, 'utf8'));
  const arms = options.arms || ARMS;
  const repetitions = options.repetitions ?? 3;
  const concurrency = options.concurrency ?? 4;
  if (
    !Number.isInteger(repetitions) ||
    repetitions < 1 ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 16 ||
    !arms.length ||
    arms.some((arm) => !ARMS.includes(arm)) ||
    new Set(arms).size !== arms.length
  )
    throw new Error('Invalid arms, repetitions, or concurrency (1–16)');
  if (
    !prompts.length ||
    new Set(prompts.map((p) => p.id)).size !== prompts.length ||
    prompts.some((p) => !/^[a-z0-9-]+$/.test(p.id) || !p.prompt || !Array.isArray(p.requiredFacts))
  )
    throw new Error('Invalid prompt cases');
  const cli = options.cli || 'claude';
  const cliVersion = execFileSync(cli, ['--version'], { encoding: 'utf8' }).trim();
  const model = options.model || 'claude-haiku-4-5-20251001';
  const runId = `${new Date().toISOString().replaceAll(':', '-')}-${crypto.randomUUID().slice(0, 8)}`;
  const out = path.resolve(options.out || path.join(__dirname, 'runs'), runId);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(out); // unique directory; never overwrite an earlier run
  const write = (name, value) =>
    fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const systemPrompt =
    'You are a helpful assistant. Answer the user accurately and follow their requested language and format.';
  const commonArgs = [
    '--safe-mode',
    '--tools',
    '',
    '--strict-mcp-config',
    '--mcp-config',
    '{"mcpServers":{}}',
    '--disable-slash-commands',
    '--no-session-persistence',
    '--output-format',
    'json',
    '--model',
    model,
    '--system-prompt',
    systemPrompt,
  ];
  const prefixes = Object.fromEntries(
    arms.map((arm) => [
      arm,
      arm === 'baseline' ? '' : arm === 'terse' ? 'Answer concisely.' : loadInjectionBlock(arm),
    ])
  );
  if (Object.values(prefixes).some((prefix) => prefix === null))
    throw new Error('Missing persona payload');
  const manifest = {
    schemaVersion: 1,
    runId,
    startedAt: new Date().toISOString(),
    model,
    cliVersion,
    arms,
    repetitions,
    concurrency,
    systemPrompt,
    invocation: commonArgs,
    isolation: {
      ERIDIAN_OFF: '1',
      safeMode: true,
      tools: [],
      skills: false,
      mcp: false,
      cwd: 'fresh temporary directory',
      scope: 'isolated response style; runtime hooks tested separately',
    },
    ruleHash: hash(fs.readFileSync(SKILL_FILE)),
    promptHash: hash(fs.readFileSync(promptFile)),
    scorerHash: hash(fs.readFileSync(path.join(root, 'scripts/lib/readcost.js'))),
    prefixes,
    splitPolicy: 'held-out cases are evaluated but not used to tune rules',
    usageScope: 'provider-reported usage; output can include thinking; not prose-only calibration',
    qualityReviewRequired: true,
  };
  write('manifest.json', manifest);
  write('prompts.json', prompts);
  const tasks = [];
  for (let repetition = 1; repetition <= repetitions; repetition++) {
    for (const prompt of prompts) for (const arm of arms) tasks.push({ prompt, arm, repetition });
  }
  // Rotate order across repeats to reduce a fixed arm-order bias.
  tasks.sort(
    (a, b) =>
      a.repetition - b.repetition ||
      a.prompt.id.localeCompare(b.prompt.id) ||
      ((ARMS.indexOf(a.arm) + a.repetition) % ARMS.length) -
        ((ARMS.indexOf(b.arm) + b.repetition) % ARMS.length)
  );
  const records = [];
  async function one({ prompt, arm, repetition }) {
    const id = `${prompt.id}--${arm}--${repetition}`;
    const text = prefixes[arm] ? `${prefixes[arm]}\n\n${prompt.prompt}` : prompt.prompt;
    const startedAt = new Date().toISOString(),
      started = Date.now();
    const result = await new Promise((resolve) => {
      const child = spawn(cli, ['-p', text, ...commonArgs], {
        cwd: isolatedCwd,
        env: { ...process.env, ERIDIAN_OFF: '1', CLAUDE_CODE_SAFE_MODE: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '',
        stderr = '',
        timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, options.timeoutMs || 180000);
      child.stdout.on('data', (data) => {
        stdout += data;
      });
      child.stderr.on('data', (data) => {
        stderr += data;
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, error: error.message });
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code, timedOut });
      });
    });
    write(`${id}.raw.json`, result);
    const record = {
      schemaVersion: 1,
      runId,
      promptId: prompt.id,
      split: prompt.split,
      language: prompt.language,
      arm,
      repetition,
      startedAt,
      durationMs: Date.now() - started,
      ruleHash: manifest.ruleHash,
      promptHash: hash(text),
    };
    try {
      if (result.error || result.exitCode !== 0 || result.timedOut)
        throw new Error(result.error || `CLI exit ${result.exitCode}; timedOut=${result.timedOut}`);
      const parsed = validateResult(result.stdout);
      Object.assign(record, {
        status: 'complete',
        reply: parsed.result,
        usage: parsed.usage,
        modelUsage: parsed.modelUsage || null,
        actualModels: Object.keys(parsed.modelUsage || {}),
        diagnostics: score(parsed.result, { language: prompt.language }),
        stopReason: parsed.stop_reason || null,
      });
    } catch (error) {
      Object.assign(record, { status: 'failed', error: error.message });
    }
    records.push(record);
    write(`${id}.json`, record);
    console.log(`${records.length}/${tasks.length} ${id} ${record.status}`);
  }
  let next = 0;
  const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-style-eval-'));
  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
        while (next < tasks.length) await one(tasks[next++]);
      })
    );
    records.sort(
      (a, b) =>
        a.promptId.localeCompare(b.promptId) ||
        a.repetition - b.repetition ||
        a.arm.localeCompare(b.arm)
    );
    write('records.json', records);
    write('summary.json', summarize(records));
    const { pairs, key } = anonymize(records, prompts);
    write('paired-review.json', pairs);
    write('paired-key.json', key);
    write('completion.json', {
      finishedAt: new Date().toISOString(),
      successful: records.filter((r) => r.status === 'complete').length,
      failed: records.filter((r) => r.status !== 'complete').length,
    });
    console.log(`Run retained: ${out}`);
    return { out, records, manifest };
  } finally {
    fs.rmSync(isolatedCwd, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (ARMS.includes(arg)) (options.arms ||= []).push(arg);
    else if (
      ['--model', '--prompts', '--out', '--repetitions', '--concurrency'].includes(arg) &&
      args[i + 1]
    ) {
      const key = arg.slice(2);
      options[key] = ['repetitions', 'concurrency'].includes(key) ? Number(args[++i]) : args[++i];
    } else {
      console.error(`Unknown or incomplete option: ${arg}`);
      process.exit(1);
    }
  }
  run(options)
    .then(({ records }) => {
      if (records.some((r) => r.status !== 'complete')) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
module.exports = { run };
