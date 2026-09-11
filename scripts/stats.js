#!/usr/bin/env node
const { readStore, commandSessionId } = require('./lib/state');
const { readCache, allCaches } = require('./lib/session-savings');
const { formatTokens } = require('./statusline');
const id = commandSessionId();
const cache = readCache(id);
const estimate = (value) =>
  value === null
    ? 'unavailable (no applicable prose calibration)'
    : `~${formatTokens(value)} tokens estimated prose output reduction`;
console.log('♫ eridian stats — output reduction estimates, not measured savings\n');
console.log(
  `this session: ${cache ? estimate(cache.savedTokens) : 'unavailable (no identified session accounting data)'}\n`
);
const caches = allCaches();
console.log('lifetime (all retained schema-2 session accounting caches):');
console.log(`sessions accounted: ${caches.length}`);
console.log(
  `observed active-mode output: ${caches.reduce((sum, c) => sum + c.outputTokens, 0)} tokens`
);
const estimates = caches.filter((c) => c.savedTokens !== null);
console.log(
  `lifetime: ${estimate(estimates.length ? estimates.reduce((sum, c) => sum + c.savedTokens, 0) : null)}`
);
console.log(`sessions without applicable calibration: ${caches.length - estimates.length}`);
if (readStore().legacy.events.length)
  console.log('legacy history: unknown session attribution; excluded from estimates');

console.log(
  `calibrated prose output covered: ${caches.reduce((sum, c) => sum + (c.calibratedOutputTokens || 0), 0)} tokens (other output excluded from reduction estimates)`
);

if (process.argv.includes('--diagnostics')) {
  const option = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const { sessionDiagnostics } = require('./lib/session-diagnostics');
  const report = sessionDiagnostics({
    sessionId: id,
    transcriptPath: option('--transcript') || cache?.transcriptPath,
    language: option('--language') || 'und',
  });
  console.log(
    '\nOptional style diagnostics — observed assistant prose only; not quality or reading time.'
  );
  if (!report)
    console.log(
      'unavailable (requires current session ID, readable transcript, and valid language tag)'
    );
  else {
    console.log(
      `session: ${report.sessionId}; language: ${report.language}; lexical dictionary: ${report.lexicalSupported ? 'supported' : 'unsupported (not zero)'}`
    );
    console.log(
      `included replies: ${report.includedReplies}; prose words: ${report.proseWords}; excluded non-prose replies: ${report.excludedNonProseReplies}; unidentified records: ${report.unidentifiedRecords}`
    );
    console.log(
      `excluded session records: ${report.excludedSessionRecords}; malformed records: ${report.malformedRecords}; oversized records: ${report.oversizedRecords}`
    );
    console.log(`raw counts: ${JSON.stringify(report.counts)}`);
    console.log(
      `phrase matches per 100 prose words: ${report.phraseMatchRatePer100ProseWords === null ? 'unavailable' : report.phraseMatchRatePer100ProseWords.toFixed(2)}`
    );
    console.log(
      'Tool/thinking/artifact blocks and marked code/quotes excluded; unmarked artifacts and language mixing may remain. Counts are observations, not advice to remove caution.'
    );
  }
}
