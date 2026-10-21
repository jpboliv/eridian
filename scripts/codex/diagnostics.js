const { selectDiagnosticSnapshot, aggregateDiagnostics } = require('../lib/diagnostics-core');

const count = (value) => (Number.isInteger(value) && value >= 0 ? value : 0);

function normalizedDiagnostics({
  events,
  sessionId,
  language = 'und',
  malformedRecords = 0,
  unsupportedRecords = 0,
  oversizedRecords = 0,
} = {}) {
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
    const key = JSON.stringify([event.model || null, event.id]);
    records.set(key, selectDiagnosticSnapshot(records.get(key), event, language));
  }
  return {
    ...aggregateDiagnostics(records.values(), language),
    sessionId,
    unidentifiedRecords,
    unsupportedRecords: count(unsupportedRecords),
    malformedRecords: count(malformedRecords),
    oversizedRecords: count(oversizedRecords),
  };
}

module.exports = { normalizedDiagnostics };
