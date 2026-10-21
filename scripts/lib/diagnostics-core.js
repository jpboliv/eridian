const { score, SCHEMA_VERSION } = require('./readcost');

// Select prose independently of usage-only stream updates. Both host adapters
// retain this record shape; Claude also serializes it in its incremental cache.
function selectDiagnosticSnapshot(previous, { content, outputTokens }, language) {
  const text = Array.isArray(content)
    ? content
        .filter((block) => block?.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
    : '';
  const tokens = Number.isFinite(outputTokens) && outputTokens >= 0 ? outputTokens : null;
  if (
    previous &&
    previous.textLength > 0 &&
    (!text.length ||
      (previous.tokens !== null && tokens !== null && tokens < previous.tokens) ||
      ((tokens === null || tokens === previous.tokens) && text.length <= previous.textLength))
  )
    return previous;
  const diagnostics = score(text, { language });
  return { tokens, textLength: text.length, diagnostics, included: diagnostics.proseWords > 0 };
}

function aggregateDiagnostics(records, language) {
  const empty = score('', { language });
  const counts = Object.fromEntries(
    Object.entries(empty.counts).map(([key, value]) => [key, value === null ? null : 0])
  );
  let includedReplies = 0;
  let excludedNonProseReplies = 0;
  let proseWords = 0;
  let sentences = 0;
  let longSentences = 0;
  let phraseMatches = empty.lexicalSupported ? 0 : null;
  for (const record of records) {
    if (!record.included) {
      excludedNonProseReplies++;
      continue;
    }
    includedReplies++;
    const item = record.diagnostics;
    proseWords += item.proseWords;
    sentences += item.sentences;
    longSentences += item.longSentences;
    if (phraseMatches !== null) phraseMatches += item.phraseMatches;
    for (const key of Object.keys(counts))
      if (counts[key] !== null) counts[key] += item.counts[key];
  }
  return {
    label: 'optional style diagnostics',
    language,
    lexicalSupported: empty.lexicalSupported,
    scorerVersion: SCHEMA_VERSION,
    includedReplies,
    excludedNonProseReplies,
    proseWords,
    sentences,
    longSentences,
    counts,
    phraseMatches,
    phraseMatchRatePer100ProseWords:
      phraseMatches !== null && proseWords ? (phraseMatches * 100) / proseWords : null,
  };
}

module.exports = { selectDiagnosticSnapshot, aggregateDiagnostics };
