const { score, SCHEMA_VERSION } = require('../lib/readcost');

function normalizedDiagnostics({ events, sessionId, language = 'und' } = {}) {
  if (
    typeof sessionId !== 'string' ||
    !sessionId ||
    typeof language !== 'string' ||
    !/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(language)
  )
    return null;
  language = language.toLowerCase();
  const records = new Map();
  let unidentifiedRecords = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (!event?.id) {
      unidentifiedRecords++;
      continue;
    }
    const text = Array.isArray(event.content)
      ? event.content
          .filter((block) => block?.type === 'text' && typeof block.text === 'string')
          .map((block) => block.text)
          .join('\n')
      : '';
    const key = JSON.stringify([event.model || null, event.id]);
    const old = records.get(key);
    if (old && (!text.length || event.outputTokens < old.tokens || text.length <= old.textLength))
      continue;
    const diagnostics = score(text, { language });
    records.set(key, {
      tokens: event.outputTokens,
      textLength: text.length,
      diagnostics,
      included: diagnostics.proseWords > 0,
    });
  }
  const rows = [...records.values()].filter((record) => record.included);
  const empty = score('', { language });
  const counts = Object.fromEntries(
    Object.entries(empty.counts).map(([key, value]) => [key, value === null ? null : 0])
  );
  let proseWords = 0;
  let sentences = 0;
  let longSentences = 0;
  let phraseMatches = empty.lexicalSupported ? 0 : null;
  for (const { diagnostics: item } of rows) {
    proseWords += item.proseWords;
    sentences += item.sentences;
    longSentences += item.longSentences;
    if (phraseMatches !== null) phraseMatches += item.phraseMatches;
    for (const key of Object.keys(counts))
      if (counts[key] !== null) counts[key] += item.counts[key];
  }
  return {
    label: 'optional style diagnostics',
    sessionId,
    language,
    lexicalSupported: empty.lexicalSupported,
    scorerVersion: SCHEMA_VERSION,
    includedReplies: rows.length,
    excludedNonProseReplies: records.size - rows.length,
    unidentifiedRecords,
    excludedSessionRecords: 0,
    oversizedRecords: 0,
    malformedRecords: 0,
    proseWords,
    sentences,
    longSentences,
    counts,
    phraseMatches,
    phraseMatchRatePer100ProseWords:
      phraseMatches !== null && proseWords ? (phraseMatches * 100) / proseWords : null,
  };
}

module.exports = { normalizedDiagnostics };
