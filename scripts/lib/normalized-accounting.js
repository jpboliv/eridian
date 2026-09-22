const { buildWindows, MILESTONES } = require('./stats-lib');

function accountNormalizedEvents({ events, state, factors = null, nowMs = Date.now() }) {
  const records = {};
  let unidentifiedOutputTokens = 0;
  const windows = buildWindows(state?.events || [], nowMs);
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || !Number.isFinite(event.tsMs) || !Number.isFinite(event.outputTokens)) continue;
    if (event.outputTokens < 0 || typeof event.id !== 'string' || !event.id) {
      unidentifiedOutputTokens += Math.max(0, event.outputTokens || 0);
      continue;
    }
    const key = JSON.stringify([event.model || null, event.id]);
    const window = windows.find(
      (candidate) => event.tsMs >= candidate.startMs && event.tsMs < candidate.endMs
    );
    const record = records[key] || {
      tsMs: event.tsMs,
      model: event.model || null,
      level: window?.level || null,
      rule: window?.rule || null,
      outputTokens: 0,
      category: event.category || 'unknown',
    };
    record.outputTokens = Math.max(record.outputTokens, event.outputTokens);
    if (event.category && event.category !== 'prose') record.category = event.category;
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
    const calibration = factors && factors._calibration;
    const factor =
      calibration &&
      typeof calibration.id === 'string' &&
      calibration.id &&
      calibration.scope === 'prose-only' &&
      calibration.rule === record.rule &&
      calibration.model === record.model
        ? factors[record.level]
        : null;
    if (typeof factor !== 'number' || !Number.isFinite(factor) || factor >= 1) continue;
    calibratedMessages++;
    calibratedOutputTokens += record.outputTokens;
    reduction += record.outputTokens / (1 - factor) - record.outputTokens;
  }
  const savedTokens = calibratedMessages ? Math.round(reduction) : null;
  return {
    records,
    outputTokens,
    eligibleOutputTokens,
    calibratedOutputTokens,
    unidentifiedOutputTokens,
    savedTokens,
    crossed: savedTokens === null ? [] : MILESTONES.filter((m) => savedTokens >= m),
    estimateLabel: 'estimated prose output reduction',
  };
}

module.exports = { accountNormalizedEvents };
