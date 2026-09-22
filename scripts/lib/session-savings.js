const fs = require('node:fs');
const path = require('node:path');
const { STATE_DIR, sessionId: validId } = require('./state');
const { atomicWrite, withLock } = require('./atomic');
const { category, accountEvents } = require('./accounting-core');
const SESSIONS_DIR = path.join(STATE_DIR, 'sessions');
function readCache(id) {
  if (!validId(id)) return null;
  try {
    const cache = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, `${id}.json`), 'utf8'));
    return cache.version === 2 &&
      cache.sessionId === id &&
      cache.records &&
      Number.isFinite(cache.outputTokens) &&
      (cache.savedTokens === null || Number.isFinite(cache.savedTokens))
      ? cache
      : null;
  } catch {
    return null;
  }
}
// Claude transcript lines become host-neutral events for the shared accounting core.
function transcriptEvents(lines) {
  const events = [];
  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const message = obj.message;
    const tokens = message?.usage?.output_tokens;
    if (obj.type !== 'assistant' || !Number.isFinite(tokens) || tokens < 0) continue;
    const rawId = message.id || obj.uuid;
    events.push({
      id: typeof rawId === 'string' && rawId ? rawId : null,
      model: message.model || null,
      tsMs: Date.parse(obj.timestamp),
      outputTokens: tokens,
      category:
        message.usage.output_tokens_details?.thinking_tokens > 0
          ? 'protected-or-mixed'
          : category(message.content),
    });
  }
  return events;
}
function sessionSavings({ sessionId, transcriptPath }, state, factors, nowMs) {
  if (!validId(sessionId) || typeof transcriptPath !== 'string') return null;
  const file = path.join(SESSIONS_DIR, `${sessionId}.json`);
  try {
    return withLock(file, () => {
      const previous = readCache(sessionId);
      const text = fs.readFileSync(transcriptPath, 'utf8');
      const lines = text.slice(0, text.lastIndexOf('\n') + 1).split('\n');
      const { crossed, milestonesHit, ...totals } = accountEvents({
        events: transcriptEvents(lines),
        state,
        factors,
        nowMs,
        previous,
      });
      const cache = {
        version: 2,
        sessionId,
        transcriptPath,
        ...totals,
        milestonesHit,
        updatedAt: new Date(nowMs).toISOString(),
      };
      atomicWrite(file, cache);
      return { ...cache, crossed };
    });
  } catch {
    return null;
  }
}
function currentSessionSaved(id) {
  return readCache(id)?.savedTokens ?? null;
}
function allCaches() {
  try {
    return fs
      .readdirSync(SESSIONS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readCache(f.slice(0, -5)))
      .filter(Boolean);
  } catch {
    return [];
  }
}
module.exports = { sessionSavings, currentSessionSaved, readCache, allCaches, SESSIONS_DIR };
