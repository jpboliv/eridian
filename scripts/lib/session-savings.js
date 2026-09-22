const fs = require('node:fs');
const path = require('node:path');
const { STATE_DIR, sessionId: validId } = require('./state');
const { atomicWrite, withLock } = require('./atomic');
const { buildWindows, MILESTONES } = require('./stats-lib');
const SESSIONS_DIR = path.join(STATE_DIR, 'sessions');
function readCache(id, { stateDir = STATE_DIR } = {}) {
  if (!validId(id)) return null;
  try {
    const cache = JSON.parse(
      fs.readFileSync(path.join(stateDir, 'sessions', `${id}.json`), 'utf8')
    );
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
function calibrationFor(factors, model, rule) {
  const c = factors._calibration;
  return c &&
    typeof c.id === 'string' &&
    c.id &&
    typeof c.rule === 'string' &&
    c.rule &&
    c.rule === rule &&
    c.model === model &&
    typeof model === 'string' &&
    c.scope === 'prose-only'
    ? { ...c, factors: { ...factors, _calibration: undefined } }
    : null;
}
function category(content) {
  if (!Array.isArray(content) || !content.length) return 'unknown';
  return content.every(
    (block) =>
      block?.type === 'text' &&
      typeof block.text === 'string' &&
      !/[`]|^[ \t]*~{3,}|^ {4}\S/m.test(block.text)
  )
    ? 'prose'
    : 'protected-or-mixed';
}
function sessionSavings(
  { sessionId, transcriptPath, stateDir = STATE_DIR },
  state,
  factors,
  nowMs
) {
  if (!validId(sessionId) || typeof transcriptPath !== 'string') return null;
  const file = path.join(stateDir, 'sessions', `${sessionId}.json`);
  try {
    return withLock(file, () => {
      const previous = readCache(sessionId, { stateDir });
      const text = fs.readFileSync(transcriptPath, 'utf8');
      const lines = text.slice(0, text.lastIndexOf('\n') + 1).split('\n');
      const records = {};
      const windows = buildWindows(state.events || [], nowMs);
      let unidentifiedOutputTokens = 0;
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
        const tsMs = Date.parse(obj.timestamp);
        if (!Number.isFinite(tsMs)) continue;
        const rawId = message.id || obj.uuid;
        if (typeof rawId !== 'string' || !rawId) {
          unidentifiedOutputTokens += tokens;
          continue;
        }
        const key = JSON.stringify([message.model || null, rawId]);
        const existing = records[key];
        const old = previous?.records?.[key];
        const window = windows.find((w) => tsMs >= w.startMs && tsMs < w.endMs);
        const observedCategory =
          message.usage.output_tokens_details?.thinking_tokens > 0
            ? 'protected-or-mixed'
            : category(message.content);
        const record = existing || {
          tsMs,
          model: message.model || null,
          level: window?.level || null,
          outputTokens: 0,
          category: observedCategory,
          calibration: old ? old.calibration : calibrationFor(factors, message.model, window?.rule),
        };
        record.outputTokens = Math.max(record.outputTokens, tokens);
        if (observedCategory !== 'prose') record.category = observedCategory;
        records[key] = record;
      }
      let outputTokens = 0;
      let eligibleOutputTokens = 0;
      let calibratedOutputTokens = 0;
      let reduction = 0;
      let calibratedMessages = 0;
      for (const record of Object.values(records)) {
        if (!record.level) continue;
        outputTokens += record.outputTokens;
        if (record.category !== 'prose') continue;
        eligibleOutputTokens += record.outputTokens;
        const factor = record.calibration?.factors?.[record.level];
        if (typeof factor !== 'number' || !Number.isFinite(factor) || factor >= 1) continue;
        calibratedMessages++;
        calibratedOutputTokens += record.outputTokens;
        reduction += record.outputTokens / (1 - factor) - record.outputTokens;
      }
      const savedTokens = calibratedMessages ? Math.round(reduction) : null;
      const milestonesHit = previous?.milestonesHit || [];
      const crossed =
        savedTokens === null
          ? []
          : MILESTONES.filter((m) => savedTokens >= m && !milestonesHit.includes(m));
      const cache = {
        version: 2,
        sessionId,
        transcriptPath,
        records,
        outputTokens,
        eligibleOutputTokens,
        calibratedOutputTokens,
        unidentifiedOutputTokens,
        savedTokens,
        estimateLabel: 'estimated prose output reduction',
        milestonesHit: [...milestonesHit, ...crossed],
        updatedAt: new Date(nowMs).toISOString(),
      };
      atomicWrite(file, cache);
      return { ...cache, crossed };
    });
  } catch {
    return null;
  }
}
function currentSessionSaved(id, { stateDir = STATE_DIR } = {}) {
  return readCache(id, { stateDir })?.savedTokens ?? null;
}
function allCaches({ stateDir = STATE_DIR } = {}) {
  try {
    return fs
      .readdirSync(path.join(stateDir, 'sessions'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => readCache(f.slice(0, -5), { stateDir }))
      .filter(Boolean);
  } catch {
    return [];
  }
}
module.exports = { sessionSavings, currentSessionSaved, readCache, allCaches, SESSIONS_DIR };
