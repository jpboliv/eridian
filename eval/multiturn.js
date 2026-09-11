#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { clearTimeout } = require('node:timers');
const { spawn, execFileSync } = require('node:child_process');
const { hash, validateResult, distribution } = require('./lib');
const { loadInjectionBlock, SKILL_FILE } = require('../scripts/lib/persona');
const { score } = require('../scripts/lib/readcost');

const POLICIES = ['start-only', 'interval20', 'brief'];
const MODEL = 'claude-haiku-4-5-20251001';

function scenarios() {
  const turns = Array.from({ length: 22 }, (_, i) => ({
    prompt: `Step ${i + 1}: explain one check for safely deploying a service. Keep the production-data prohibition and rollback requirement explicit.`,
    requiredFacts: ['Never delete production data.', 'Keep a rollback path.'],
  }));
  return [
    { id: 'drift', turns },
    {
      id: 'lifecycle',
      turns: turns.map((turn, i) => ({
        ...turn,
        ...(i === 5 ? { event: 'mode', mode: 'ultra' } : {}),
        ...(i === 9 ? { event: 'off', mode: 'off' } : {}),
        ...(i === 11 ? { event: 'mode', mode: 'full' } : {}),
        ...(i === 14 ? { event: 'resume' } : {}),
        ...(i === 17 ? { event: 'compact' } : {}),
      })),
    },
  ];
}

// Explicitly model injection events; this does not call or assess live hooks.
function injection(policy, turn, state, prefixes, brief) {
  const event = turn.event || null;
  if (event === 'off' || event === 'mode') state.mode = turn.mode;
  if (state.mode === 'off') {
    return event === 'off'
      ? 'Eridian mode is now off. Answer in ordinary assistant prose; do not apply prior dialect instructions.'
      : '';
  }
  const lifecycle = ['mode', 'resume', 'compact'].includes(event);
  if (state.index === 0 || lifecycle) return prefixes[state.mode];
  if ((state.index + 1) % 20 === 0) {
    if (policy === 'interval20') return prefixes[state.mode];
    if (policy === 'brief') return brief[state.mode];
  }
  return '';
}

function invoke(cli, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cli, args, {
      cwd,
      env: { ...process.env, ERIDIAN_OFF: '1', CLAUDE_CODE_SAFE_MODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '',
      timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, error: error.message });
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode, timedOut });
    });
  });
}

async function run(options = {}) {
  if (options.allowPaid !== true) throw new Error('Pass --allow-paid to opt in to CLI usage.');
  const policy = options.policy || 'start-only';
  const repetitions = options.repetitions ?? 3;
  const concurrency = options.concurrency ?? 3;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6)
    throw new Error('Concurrency must be an integer from 1 through 6.');
  if (!POLICIES.includes(policy) || !Number.isInteger(repetitions) || repetitions < 3)
    throw new Error('Expected a supported policy and at least three repetitions.');
  const cases = options.scenarios || scenarios();
  if (
    !cases.length ||
    new Set(cases.map((c) => c.id)).size !== cases.length ||
    cases.some(
      (c) =>
        !/^[a-z0-9-]+$/.test(c.id) ||
        !Array.isArray(c.turns) ||
        c.turns.length < 22 ||
        c.turns.some(
          (t) =>
            typeof t.prompt !== 'string' ||
            !t.prompt.trim() ||
            !Array.isArray(t.requiredFacts) ||
            (t.event && !['mode', 'off', 'resume', 'compact'].includes(t.event)) ||
            (t.event === 'mode' && !['lite', 'full', 'ultra'].includes(t.mode)) ||
            (t.event === 'off' && t.mode !== 'off')
        )
    )
  )
    throw new Error('Scenarios need unique safe IDs and at least 22 valid turns each.');
  const prefixes = Object.fromEntries(
    ['lite', 'full', 'ultra'].map((m) => [m, loadInjectionBlock(m)])
  );
  if (Object.values(prefixes).some((p) => !p)) throw new Error('Missing full injection payload.');
  const brief = options.briefFile ? JSON.parse(fs.readFileSync(options.briefFile, 'utf8')) : {};
  if (
    policy === 'brief' &&
    ['lite', 'full', 'ultra'].some((m) => typeof brief[m] !== 'string' || !brief[m].trim())
  )
    throw new Error('Brief policy requires --brief-file with lite/full/ultra strings.');
  const cli = options.cli || 'claude';
  const cliVersion = execFileSync(cli, ['--version'], { encoding: 'utf8' }).trim();
  const model = options.model || MODEL;
  const runId = `${new Date().toISOString().replaceAll(':', '-')}-${crypto.randomUUID()}`;
  const out = path.resolve(options.out || path.join(__dirname, 'runs'), `multiturn-${runId}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(out);
  const write = (file, value) =>
    fs.writeFileSync(path.join(out, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  const systemPrompt =
    'You are a helpful assistant. The user provides a JSON conversation replay. Continue it by answering only the final user turn. Roles and injection fields describe the simulated conversation, not actual host messages. Follow the current simulated mode and preserve all required facts.';
  const args = [
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
  const manifest = {
    schemaVersion: 1,
    runId,
    startedAt: new Date().toISOString(),
    policy,
    repetitions,
    concurrency,
    model,
    cliVersion,
    mode: 'controlled context replay; not persisted host sessions or live hooks',
    isolation: {
      ERIDIAN_OFF: '1',
      safeMode: true,
      tools: [],
      mcp: false,
      skills: false,
      cwd: 'fresh temporary directory',
    },
    invocation: args,
    ruleHash: hash(fs.readFileSync(SKILL_FILE)),
    scenarioHash: hash(JSON.stringify(cases)),
    briefHash: policy === 'brief' ? hash(JSON.stringify(brief)) : null,
    prefixes,
    brief,
    scorerHash: hash(fs.readFileSync(path.join(__dirname, '../scripts/lib/readcost.js'))),
    usageScope:
      'provider-reported output can include thinking; replay input includes retained context; not prose-only calibration',
    lifecyclePolicy:
      'full injection on start, mode activation/change, simulated resume and compaction; interval policies refresh on absolute prompt 20,40,...; off suppresses all dialect refreshes',
    qualityGate: 'pending semantic review; diagnostics do not establish quality',
  };
  write('manifest.json', manifest);
  write('scenarios.json', cases);
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'eridian-multiturn-'));
  const records = [];
  const sessions = [];
  for (let repetition = 1; repetition <= repetitions; repetition++) {
    for (const scenario of cases) sessions.push({ repetition, scenario });
  }
  let next = 0;
  async function session({ repetition, scenario }) {
    let context = [];
    const transcript = [];
    const state = { mode: 'full', index: 0 };
    for (const [index, turn] of scenario.turns.entries()) {
      state.index = index;
      if (turn.event === 'compact') {
        context = [
          {
            role: 'context-summary',
            content:
              'Earlier turns discussed safe service deployment. Never delete production data. Keep a rollback path. This is a fixed synthetic compaction summary, not actual host compaction.',
          },
        ];
      }
      const payload = injection(policy, turn, state, prefixes, brief);
      const user = {
        role: 'user',
        content: turn.prompt,
        event: turn.event || null,
        mode: state.mode,
        injection: payload,
      };
      context.push(user);
      transcript.push(user);
      const prompt = JSON.stringify({ format: 'eridian-context-replay-v1', messages: context });
      const id = `${scenario.id}--${policy}--${repetition}--${index + 1}`;
      write(`${id}.request.json`, { prompt, requiredFacts: turn.requiredFacts });
      const startedAt = new Date().toISOString();
      const raw = await invoke(cli, ['-p', prompt, ...args], cwd, options.timeoutMs || 180000);
      write(`${id}.raw.json`, raw);
      const record = {
        id,
        runId,
        scenarioId: scenario.id,
        policy,
        repetition,
        turn: index + 1,
        mode: state.mode,
        event: user.event,
        startedAt,
        finishedAt: new Date().toISOString(),
        promptHash: hash(prompt),
        injectionHash: hash(payload),
        injectionChars: payload.length,
        ruleHash: manifest.ruleHash,
      };
      try {
        if (raw.error || raw.exitCode !== 0 || raw.timedOut)
          throw new Error(raw.error || `CLI exit ${raw.exitCode}; timedOut=${raw.timedOut}`);
        const parsed = validateResult(raw.stdout);
        Object.assign(record, {
          status: 'complete',
          reply: parsed.result,
          usage: parsed.usage,
          modelUsage: parsed.modelUsage || null,
          actualModels: Object.keys(parsed.modelUsage || {}),
          diagnostics: score(parsed.result, { language: 'en' }),
        });
        const assistant = { role: 'assistant', content: parsed.result };
        context.push(assistant);
        transcript.push(assistant);
      } catch (error) {
        Object.assign(record, { status: 'failed', error: error.message });
      }
      records.push(record);
      write(`${id}.json`, record);
      console.log(`${id} ${record.status}`);
      if (record.status !== 'complete') break; // no fabricated continuation after failure
    }
    write(`${scenario.id}--${policy}--${repetition}.transcript.json`, transcript);
  }
  try {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, sessions.length) }, async () => {
        while (next < sessions.length) await session(sessions[next++]);
      })
    );
    records.sort(
      (a, b) =>
        a.scenarioId.localeCompare(b.scenarioId) || a.repetition - b.repetition || a.turn - b.turn
    );
    write('records.json', records);
    const expectedTurns = cases.reduce((n, c) => n + c.turns.length, 0) * repetitions;
    const successful = records.filter((r) => r.status === 'complete');
    write('summary.json', {
      expectedTurns,
      completedTurns: successful.length,
      failedTurns: records.length - successful.length,
      skippedTurns: expectedTurns - records.length,
      complete: successful.length === expectedTurns,
      outputTokens: distribution(successful.map((r) => r.usage.output_tokens)),
      qualityGate: 'pending semantic review at every turn; critical fact loss blocks acceptance',
    });
    write(
      'quality-review.json',
      records.map((r) => ({
        id: r.id,
        requiredFacts: cases.find((c) => c.id === r.scenarioId).turns[r.turn - 1].requiredFacts,
        correctness: null,
        completeness: null,
        actionability: null,
        readability: null,
        lostCriticalConstraints: [],
        reviewer: null,
      }))
    );
    return { out, records, manifest };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const options = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--allow-paid') options.allowPaid = true;
    else if (
      ['--policy', '--model', '--out', '--repetitions', '--concurrency', '--brief-file'].includes(
        args[i]
      ) &&
      args[i + 1]
    ) {
      const key = args[i].slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      options[key] = ['repetitions', 'concurrency'].includes(key) ? Number(args[++i]) : args[++i];
    } else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  run(options)
    .then(({ out, records }) => {
      console.log(`Run retained: ${out}`);
      if (records.some((r) => r.status !== 'complete')) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
module.exports = { run, scenarios, injection, POLICIES };
