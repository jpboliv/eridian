const MILESTONES = [10_000, 50_000, 100_000, 500_000, 1_000_000];

function buildWindows(events, nowMs) {
  const sorted = [...events]
    .map((e) => ({ tsMs: Date.parse(e.ts), level: e.level }))
    .filter((e) => Number.isFinite(e.tsMs))
    .sort((a, b) => a.tsMs - b.tsMs);

  const windows = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].level === 'off') continue;
    const end = i + 1 < sorted.length ? sorted[i + 1].tsMs : nowMs;
    windows.push({ startMs: sorted[i].tsMs, endMs: end, level: sorted[i].level });
  }
  return windows;
}

function attribute(messages, windows) {
  const inAnyWindow = (ts) =>
    windows.some((w) => ts >= w.startMs && ts < w.endMs);
  const totals = {};
  for (const m of messages) {
    const w = windows.find((w) => m.tsMs >= w.startMs && m.tsMs < w.endMs);
    if (!w) continue;
    // Only sessions started while a mode was active got the dialect injected.
    const sessionStart = m.sessionStartMs ?? m.tsMs;
    if (!inAnyWindow(sessionStart)) continue;
    totals[w.level] = totals[w.level] || { messages: 0, tokens: 0 };
    totals[w.level].messages += 1;
    totals[w.level].tokens += m.outputTokens;
  }
  return totals;
}

function estimateSaved(tokensByLevel, factors) {
  let saved = 0;
  for (const [level, { tokens }] of Object.entries(tokensByLevel)) {
    const r = factors[level];
    if (typeof r === 'number' && r > 0 && r < 1) {
      saved += tokens / (1 - r) - tokens;
    }
  }
  return Math.round(saved);
}

function crossedMilestones(oldSaved, newSaved) {
  return MILESTONES.filter((m) => oldSaved < m && newSaved >= m);
}

module.exports = { buildWindows, attribute, estimateSaved, crossedMilestones, MILESTONES };
