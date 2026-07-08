const fs = require('node:fs');
const path = require('node:path');
const { STATE_DIR } = require('./state');
const { buildWindows, attribute, estimateSaved, MILESTONES } = require('./stats-lib');

const SESSIONS_DIR = path.join(STATE_DIR, 'sessions');
const PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function emptyCache(transcriptPath) {
  return {
    transcriptPath,
    offset: 0,
    sessionStartMs: null,
    tokensByLevel: {},
    milestonesHit: [],
    savedTokens: 0,
  };
}

function cacheFile(sessionId) {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function readCache(sessionId, transcriptPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(cacheFile(sessionId), 'utf8'));
    if (parsed && typeof parsed === 'object' && parsed.transcriptPath === transcriptPath) {
      return { ...emptyCache(transcriptPath), ...parsed };
    }
  } catch {
    // missing or corrupt — start fresh
  }
  return emptyCache(transcriptPath);
}

function prune(nowMs) {
  try {
    for (const f of fs.readdirSync(SESSIONS_DIR)) {
      const p = path.join(SESSIONS_DIR, f);
      if (nowMs - fs.statSync(p).mtimeMs > PRUNE_AFTER_MS) fs.unlinkSync(p);
    }
  } catch {
    // best effort
  }
}

function writeCache(sessionId, cache, nowMs) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  const file = cacheFile(sessionId);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache));
  fs.renameSync(tmp, file);
  prune(nowMs);
}

// Reads complete lines past `offset`; a partial trailing line (no newline
// yet) stays unconsumed so it re-reads whole next time. Returns null when
// the file shrank (truncated/replaced) so the caller can reset.
function scanNewLines(transcriptPath, offset) {
  const size = fs.statSync(transcriptPath).size;
  if (size < offset) return null;
  if (size === offset) return { messages: [], minTsMs: null, newOffset: offset };

  const buf = Buffer.alloc(size - offset);
  const fd = fs.openSync(transcriptPath, 'r');
  try {
    fs.readSync(fd, buf, 0, buf.length, offset);
  } finally {
    fs.closeSync(fd);
  }
  const text = buf.toString('utf8');
  const lastNl = text.lastIndexOf('\n');
  if (lastNl === -1) return { messages: [], minTsMs: null, newOffset: offset };
  const complete = text.slice(0, lastNl + 1);

  const messages = [];
  let minTsMs = null;
  for (const line of complete.split('\n')) {
    try {
      const obj = JSON.parse(line);
      const tsMs = Date.parse(obj?.timestamp);
      if (Number.isFinite(tsMs) && (minTsMs === null || tsMs < minTsMs)) minTsMs = tsMs;
      const tokens = obj?.message?.usage?.output_tokens;
      if (obj.type === 'assistant' && Number.isFinite(tsMs) && tokens > 0) {
        messages.push({ tsMs, outputTokens: tokens });
      }
    } catch {
      /* skip malformed lines */
    }
  }
  return { messages, minTsMs, newOffset: offset + Buffer.byteLength(complete, 'utf8') };
}

function sessionSavings({ sessionId, transcriptPath }, state, factors, nowMs) {
  if (!sessionId || typeof sessionId !== 'string' || !/^[\w.-]+$/.test(sessionId)) return null;
  if (!transcriptPath) return null;

  let cache = readCache(sessionId, transcriptPath);
  let scan;
  try {
    scan = scanNewLines(transcriptPath, cache.offset);
    if (scan === null) {
      cache = emptyCache(transcriptPath);
      scan = scanNewLines(transcriptPath, 0);
    }
  } catch {
    return null; // transcript missing/unreadable
  }
  if (scan === null) return null;

  if (
    scan.minTsMs !== null &&
    (cache.sessionStartMs === null || scan.minTsMs < cache.sessionStartMs)
  ) {
    cache.sessionStartMs = scan.minTsMs;
  }

  if (scan.messages.length) {
    const windows = buildWindows(state.events || [], nowMs);
    const withStart = scan.messages.map((m) => ({
      ...m,
      sessionStartMs: cache.sessionStartMs ?? m.tsMs,
    }));
    for (const [level, t] of Object.entries(attribute(withStart, windows))) {
      cache.tokensByLevel[level] = (cache.tokensByLevel[level] || 0) + t.tokens;
    }
  }

  const byLevel = Object.fromEntries(
    Object.entries(cache.tokensByLevel).map(([level, tokens]) => [level, { tokens }])
  );
  const savedTokens = estimateSaved(byLevel, factors);
  const crossed = MILESTONES.filter((m) => savedTokens >= m && !cache.milestonesHit.includes(m));

  cache.savedTokens = savedTokens;
  cache.milestonesHit = [...cache.milestonesHit, ...crossed];
  cache.offset = scan.newOffset;
  try {
    writeCache(sessionId, cache, nowMs);
  } catch {
    // cache write is best-effort; the computed values still stand
  }
  return { savedTokens, crossed };
}

function latestSessionSaved() {
  try {
    let best = null;
    for (const f of fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'))) {
      const p = path.join(SESSIONS_DIR, f);
      const mtimeMs = fs.statSync(p).mtimeMs;
      if (!best || mtimeMs > best.mtimeMs) best = { p, mtimeMs };
    }
    if (!best) return null;
    const saved = JSON.parse(fs.readFileSync(best.p, 'utf8')).savedTokens;
    return Number.isFinite(saved) ? saved : null;
  } catch {
    return null;
  }
}

module.exports = { sessionSavings, latestSessionSaved, SESSIONS_DIR };
