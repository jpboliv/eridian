#!/usr/bin/env node
const fs = require('node:fs');
const { commandIdentity } = require('./input');
const { createCodexStore } = require('./store');
const { readNormalizedEvents } = require('./usage');
const { accountEvents } = require('../lib/accounting-core');
const { normalizedDiagnostics } = require('./diagnostics');

const identity = commandIdentity();
if (!identity.ok) {
  console.error(`eridian stats failed: ${identity.reason}`);
  process.exit(1);
}
const option = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const eventsPath = option('--events') || process.env.ERIDIAN_CODEX_USAGE_FILE;
const language = option('--language') || 'und';
const input = identity.id && eventsPath ? readNormalizedEvents(eventsPath, identity.id) : null;
const available = Boolean(input && !input.unavailable);
let report = null;
if (available) {
  const state = createCodexStore().readState(identity.id, { cwd: process.cwd() });
  let factors = null;
  const calibrationPath = option('--calibration');
  if (calibrationPath) {
    try {
      factors = JSON.parse(fs.readFileSync(calibrationPath, 'utf8'));
    } catch {
      factors = null;
    }
  }
  report = accountEvents({ events: input.events, state, factors });
}
const sessionLine = report
  ? report.savedTokens === null
    ? 'unavailable (no applicable Codex prose calibration)'
    : `~${report.savedTokens} tokens estimated prose output reduction`
  : input?.unavailable
    ? 'unavailable (normalized events file could not be read)'
    : 'unavailable (no verified Codex usage-event adapter input)';
console.log('♫ eridian stats — output reduction estimates, not measured savings\n');
console.log(`this session: ${sessionLine}`);
console.log('Codex calibration is host-specific; Claude factors are never reused.');
console.log(`session: ${identity.id || 'unavailable (no verified session identity)'}`);
if (available) {
  console.log(
    `input: normalized Codex input v1 (${input.events.length} events; ${input.unknown} unsupported records; ${input.malformed} malformed records; ${input.oversized} oversized records)`
  );
  console.log(`observed active-mode output: ${report.outputTokens} tokens`);
  console.log(
    `calibrated prose output covered: ${report.calibratedOutputTokens} tokens (other output excluded from reduction estimates)`
  );
  console.log(`unidentified output excluded: ${report.unidentifiedOutputTokens} tokens`);
}
if (process.argv.includes('--diagnostics')) {
  const diagnosticReport = available
    ? normalizedDiagnostics({
        events: input.events,
        sessionId: identity.id,
        language,
        malformedRecords: input.malformed,
        unsupportedRecords: input.unknown,
        oversizedRecords: input.oversized,
      })
    : null;
  console.log(
    '\nOptional style diagnostics — observed assistant prose only; not quality or reading time.'
  );
  if (!diagnosticReport)
    console.log('unavailable (requires verified session identity and normalized Codex input v1)');
  else {
    console.log(
      `session: ${diagnosticReport.sessionId}; language: ${diagnosticReport.language}; lexical dictionary: ${diagnosticReport.lexicalSupported ? 'supported' : 'unsupported (not zero)'}`
    );
    console.log(
      `included replies: ${diagnosticReport.includedReplies}; prose words: ${diagnosticReport.proseWords}; excluded non-prose replies: ${diagnosticReport.excludedNonProseReplies}; unidentified records: ${diagnosticReport.unidentifiedRecords}; unsupported: ${diagnosticReport.unsupportedRecords}; malformed: ${diagnosticReport.malformedRecords}; oversized: ${diagnosticReport.oversizedRecords}`
    );
    console.log(`raw counts: ${JSON.stringify(diagnosticReport.counts)}`);
    console.log(
      `phrase matches per 100 prose words: ${diagnosticReport.phraseMatchRatePer100ProseWords === null ? 'unavailable' : diagnosticReport.phraseMatchRatePer100ProseWords.toFixed(2)}`
    );
    console.log(
      'Tool/thinking/artifact blocks and marked code/quotes excluded; counts are observations, not advice to remove caution.'
    );
  }
}
