const fs = require('node:fs');
const { sessionId } = require('../lib/state-store');

const MAX_INPUT_BYTES = 256 * 1024;
const SOURCES = new Set(['startup', 'resume', 'clear', 'compact']);

function readInput(stream = process.stdin) {
  const raw = fs.readFileSync(stream.fd, 'utf8');
  if (Buffer.byteLength(raw) > MAX_INPUT_BYTES) throw new Error('Codex hook input is too large');
  const input = raw ? JSON.parse(raw) : {};
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('invalid hook input');
  return input;
}

function validateInput(input, { event, lifecycle = false } = {}) {
  const id = sessionId(input.session_id);
  if (!id) return { ok: false, reason: 'missing or invalid session identity' };
  if (
    typeof input.cwd !== 'undefined' &&
    (typeof input.cwd !== 'string' || input.cwd.length > 4096)
  )
    return { ok: false, reason: 'invalid working directory' };
  if (event && input.hook_event_name && input.hook_event_name !== event)
    return { ok: false, reason: 'unexpected hook event' };
  if (lifecycle && !SOURCES.has(input.source))
    return { ok: false, reason: 'unsupported lifecycle source' };
  if (input.subagent === true || input.is_subagent === true || input.agent_id)
    return { ok: false, reason: 'subagent event ignored' };
  return { ok: true, id, cwd: input.cwd || process.cwd() };
}

function commandIdentity(argv = process.argv, env = process.env) {
  const index = argv.indexOf('--session-id');
  const explicit = index >= 0 ? sessionId(argv[index + 1]) : null;
  const invalidExplicit = index >= 0 && !explicit;
  const fromEnv = sessionId(env.CODEX_THREAD_ID);
  if (invalidExplicit) return { ok: false, reason: 'invalid --session-id' };
  if (explicit && fromEnv && explicit !== fromEnv)
    return { ok: false, reason: 'session identity conflicts with CODEX_THREAD_ID' };
  return { ok: true, id: explicit || fromEnv || null };
}

module.exports = { MAX_INPUT_BYTES, SOURCES, readInput, validateInput, commandIdentity };
