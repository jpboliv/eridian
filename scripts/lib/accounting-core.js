const { buildWindows, MILESTONES } = require('./stats-lib');

// Prose means text-only blocks with no code fences, inline code or indented code.
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

function calibrationFor(factors, model, rule) {
  const c = factors?._calibration;
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

// Shared by the Claude transcript scanner and the Codex normalized adapter so both
// hosts attribute, deduplicate and calibrate identically.
// events: { id, model, tsMs, outputTokens, category }; previous: an earlier cache.
function accountEvents({ events, state, factors = null, nowMs = Date.now(), previous = null }) {
  const windows = buildWindows(state?.events || [], nowMs);
  const records = {};
  let unidentifiedOutputTokens = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (!event || !Number.isFinite(event.outputTokens) || event.outputTokens < 0) continue;
    if (!Number.isFinite(event.tsMs)) continue;
    if (typeof event.id !== 'string' || !event.id) {
      unidentifiedOutputTokens += event.outputTokens;
      continue;
    }
    const model = event.model || null;
    const key = JSON.stringify([model, event.id]);
    const existing = records[key];
    const old = previous?.records?.[key];
    const window = windows.find((w) => event.tsMs >= w.startMs && event.tsMs < w.endMs);
    const record = existing || {
      tsMs: event.tsMs,
      model,
      level: window?.level || null,
      outputTokens: 0,
      category: event.category,
      calibration: old ? old.calibration : calibrationFor(factors, model, window?.rule),
    };
    record.outputTokens = Math.max(record.outputTokens, event.outputTokens);
    if (event.category !== 'prose') record.category = event.category;
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
  return {
    records,
    outputTokens,
    eligibleOutputTokens,
    calibratedOutputTokens,
    unidentifiedOutputTokens,
    savedTokens,
    estimateLabel: 'estimated prose output reduction',
    milestonesHit: [...milestonesHit, ...crossed],
    crossed,
  };
}

module.exports = { category, calibrationFor, accountEvents, MILESTONES };
