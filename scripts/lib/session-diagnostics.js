const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { score, SCHEMA_VERSION } = require('./readcost');
const { STATE_DIR, sessionId: validId } = require('./state');
const { atomicWrite, withLock } = require('./atomic');
const CACHE_VERSION = 2;
const MAX_LINE_BYTES = 1024 * 1024;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const scorerHash = () =>
  hash(
    fs.readFileSync(require.resolve('./readcost')) +
      fs.readFileSync(require.resolve('./readcost-lexicon'))
  );

function fingerprint(fd, start, length) {
  const data = Buffer.alloc(length);
  if (fs.readSync(fd, data, 0, length, start) !== length) throw new Error('transcript changed');
  return hash(data);
}

function observe(cache, obj) {
  if (obj.type !== 'assistant') return;
  const message = obj.message;
  const rawId = message?.id || obj.uuid;
  if (typeof rawId !== 'string' || !rawId) {
    cache.unidentified[hash(JSON.stringify(obj))] = true;
    return;
  }
  const key = JSON.stringify([message?.model || null, rawId]);
  if (
    (obj.sessionId && obj.sessionId !== cache.sessionId) ||
    (obj.session_id && obj.session_id !== cache.sessionId)
  ) {
    cache.excludedSessions[key] = true;
    return;
  }
  const text = Array.isArray(message?.content)
    ? message.content
        .filter((block) => block?.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
    : '';
  const usage = message?.usage?.output_tokens;
  const tokens = Number.isFinite(usage) && usage >= 0 ? usage : null;
  const old = cache.records[key];
  if (old && !text.length && old.textLength > 0) {
    // Keep the usage associated with the selected prose snapshot. Advancing it
    // from a textless update would suppress later prose arriving out of order.
    return;
  }
  if (
    old &&
    old.textLength > 0 &&
    ((old.tokens !== null && tokens !== null && tokens < old.tokens) ||
      ((tokens === null || old.tokens === tokens) && text.length <= old.textLength))
  )
    return;
  const diagnostics = score(text, { language: cache.language });
  cache.records[key] = {
    tokens,
    textLength: text.length,
    diagnostics,
    included: diagnostics.proseWords > 0,
  };
}

function aggregate(cache) {
  const empty = score('', { language: cache.language });
  const rows = Object.values(cache.records).filter((r) => r.included);
  const counts = Object.fromEntries(
    Object.entries(empty.counts).map(([key, value]) => [key, value === null ? null : 0])
  );
  let proseWords = 0,
    phraseMatches = empty.lexicalSupported ? 0 : null,
    sentences = 0,
    longSentences = 0;
  for (const { diagnostics: d } of rows) {
    proseWords += d.proseWords;
    sentences += d.sentences;
    longSentences += d.longSentences;
    if (phraseMatches !== null) phraseMatches += d.phraseMatches;
    for (const key of Object.keys(counts)) if (counts[key] !== null) counts[key] += d.counts[key];
  }
  return {
    label: 'optional style diagnostics',
    sessionId: cache.sessionId,
    language: cache.language,
    lexicalSupported: empty.lexicalSupported,
    scorerVersion: cache.scorerVersion,
    includedReplies: rows.length,
    excludedNonProseReplies: Object.values(cache.records).length - rows.length,
    unidentifiedRecords: Object.keys(cache.unidentified).length,
    excludedSessionRecords: Object.keys(cache.excludedSessions).length,
    oversizedRecords: cache.oversizedRecords,
    malformedRecords: cache.malformedRecords,
    proseWords,
    sentences,
    longSentences,
    counts,
    phraseMatches,
    phraseMatchRatePer100ProseWords:
      phraseMatches !== null && proseWords ? (phraseMatches * 100) / proseWords : null,
  };
}

function validObservations(cache) {
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const tally = (value) => Number.isSafeInteger(value) && value >= 0;
  if (
    !object(cache) ||
    !object(cache.records) ||
    !object(cache.unidentified) ||
    !object(cache.excludedSessions) ||
    typeof cache.language !== 'string' ||
    !/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(cache.language)
  )
    return false;
  if (
    !tally(cache.offset) ||
    cache.headLength !== Math.min(cache.offset, 4096) ||
    cache.tailStart !== Math.max(0, cache.offset - 4096) ||
    cache.tailLength !== Math.min(cache.offset, 4096) ||
    typeof cache.headHash !== 'string' ||
    typeof cache.tailHash !== 'string' ||
    typeof cache.pending !== 'string' ||
    typeof cache.discarding !== 'boolean' ||
    !tally(cache.oversizedRecords) ||
    !tally(cache.malformedRecords) ||
    Object.values(cache.unidentified).some((value) => value !== true) ||
    Object.values(cache.excludedSessions).some((value) => value !== true)
  )
    return false;
  const pending = Buffer.from(cache.pending, 'base64');
  if (
    pending.toString('base64') !== cache.pending ||
    pending.length > MAX_LINE_BYTES ||
    pending.length > cache.offset ||
    (cache.discarding && pending.length)
  )
    return false;
  const expected = score('', { language: cache.language });
  const keys = Object.keys(expected.counts);
  return Object.values(cache.records).every((record) => {
    const d = record?.diagnostics;
    return (
      typeof record?.included === 'boolean' &&
      tally(record.textLength) &&
      (record.tokens === null || tally(record.tokens)) &&
      d?.schemaVersion === SCHEMA_VERSION &&
      d.language === cache.language &&
      d.lexicalSupported === expected.lexicalSupported &&
      [d.proseWords, d.sentences, d.longSentences].every(tally) &&
      record.included === d.proseWords > 0 &&
      d.longSentences <= d.sentences &&
      (expected.lexicalSupported ? tally(d.phraseMatches) : d.phraseMatches === null) &&
      object(d.counts) &&
      Object.keys(d.counts).length === keys.length &&
      keys.every(
        (key) =>
          Object.hasOwn(d.counts, key) &&
          (expected.counts[key] === null ? d.counts[key] === null : tally(d.counts[key]))
      )
    );
  });
}

function sessionDiagnostics({
  sessionId,
  transcriptPath,
  language = 'und',
  stateDir = STATE_DIR,
} = {}) {
  if (
    !validId(sessionId) ||
    typeof transcriptPath !== 'string' ||
    !transcriptPath ||
    typeof language !== 'string' ||
    !/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(language)
  )
    return null;
  language = language.toLowerCase();
  const file = path.join(stateDir, 'diagnostics', `${sessionId}.json`);
  try {
    return withLock(file, () => {
      const fd = fs.openSync(
        transcriptPath,
        fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK || 0)
      );
      try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile()) return null;
        const identity = `${stat.dev}:${stat.ino}`;
        const source = path.resolve(transcriptPath);
        const rule = scorerHash();
        let cache;
        try {
          cache = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
          /* rebuild */
        }
        let reusable =
          validObservations(cache) &&
          cache.version === CACHE_VERSION &&
          cache.sessionId === sessionId &&
          cache.scorerVersion === SCHEMA_VERSION &&
          cache.scorerHash === rule &&
          cache.language === language &&
          cache.source === source &&
          cache.identity === identity &&
          Number.isInteger(cache.offset) &&
          cache.offset >= 0 &&
          cache.offset <= stat.size &&
          cache.records &&
          cache.unidentified &&
          cache.excludedSessions &&
          typeof cache.pending === 'string';
        if (reusable && stat.size === cache.offset && stat.mtimeMs !== cache.mtimeMs)
          reusable = false;
        if (reusable)
          reusable =
            fingerprint(fd, 0, cache.headLength) === cache.headHash &&
            fingerprint(fd, cache.tailStart, cache.tailLength) === cache.tailHash;
        if (!reusable)
          cache = {
            version: CACHE_VERSION,
            scorerVersion: SCHEMA_VERSION,
            scorerHash: rule,
            sessionId,
            language,
            source,
            identity,
            offset: 0,
            pending: '',
            discarding: false,
            records: {},
            unidentified: {},
            excludedSessions: {},
            oversizedRecords: 0,
            malformedRecords: 0,
          };
        const initialOffset = cache.offset;
        let pending = Buffer.from(cache.pending, 'base64');
        const chunk = Buffer.alloc(64 * 1024);
        while (cache.offset < stat.size) {
          const n = fs.readSync(
            fd,
            chunk,
            0,
            Math.min(chunk.length, stat.size - cache.offset),
            cache.offset
          );
          if (!n) throw new Error('transcript truncated while reading');
          cache.offset += n;
          let data = Buffer.concat([pending, chunk.subarray(0, n)]);
          let start = 0;
          for (let end = data.indexOf(10); end !== -1; end = data.indexOf(10, start)) {
            const line = data.subarray(start, end);
            if (cache.discarding) cache.discarding = false;
            else if (line.length > MAX_LINE_BYTES) cache.oversizedRecords++;
            else if (line.length) {
              try {
                observe(cache, JSON.parse(line.toString('utf8')));
              } catch {
                cache.malformedRecords++;
              }
            }
            start = end + 1;
          }
          pending = data.subarray(start);
          if (pending.length > MAX_LINE_BYTES || cache.discarding) {
            if (!cache.discarding) cache.oversizedRecords++;
            cache.discarding = true;
            pending = Buffer.alloc(0);
          }
        }
        cache.pending = pending.toString('base64');
        cache.mtimeMs = stat.mtimeMs;
        cache.headLength = Math.min(cache.offset, 4096);
        cache.headHash = fingerprint(fd, 0, cache.headLength);
        cache.tailStart = Math.max(0, cache.offset - 4096);
        cache.tailLength = cache.offset - cache.tailStart;
        cache.tailHash = fingerprint(fd, cache.tailStart, cache.tailLength);
        const result = aggregate(cache);
        atomicWrite(file, cache);
        return {
          ...result,
          bytesRead: cache.offset - initialOffset,
          rebuilt: !reusable,
          pendingBytes: Buffer.from(cache.pending, 'base64').length,
        };
      } finally {
        fs.closeSync(fd);
      }
    });
  } catch {
    return null;
  }
}

module.exports = { sessionDiagnostics, CACHE_VERSION };
