const crypto = require('node:crypto');

const ARMS = ['baseline', 'terse', 'lite', 'full', 'ultra'];
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');

function validateResult(raw) {
  const result = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (
    result.is_error ||
    result.subtype !== 'success' ||
    (result.stop_reason && result.stop_reason !== 'end_turn') ||
    typeof result.result !== 'string' ||
    !result.result.trim()
  ) {
    throw new Error('Failed, empty, or truncated completion');
  }
  for (const key of ['input_tokens', 'output_tokens']) {
    if (!Number.isFinite(result.usage?.[key]) || result.usage[key] < 0) {
      throw new Error(`Missing or invalid usage.${key}`);
    }
  }
  return result;
}

function distribution(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p) => sorted[Math.floor((sorted.length - 1) * p)];
  return {
    n: values.length,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    min: sorted[0],
    p25: quantile(0.25),
    median: quantile(0.5),
    p75: quantile(0.75),
    max: sorted.at(-1),
  };
}

// Pair by prompt and repetition; never overwrite repeated observations.
function summarize(records, minimumRepetitions = 3) {
  const successful = records.filter((r) => r.status === 'complete');
  const groups = new Map();
  for (const r of successful) {
    const key = `${r.promptId}:${r.repetition}`;
    if (!groups.has(key)) groups.set(key, {});
    if (groups.get(key)[r.arm]) throw new Error(`Duplicate cell ${key}:${r.arm}`);
    groups.get(key)[r.arm] = r;
  }
  const comparisons = {};
  for (const reference of ['baseline', 'terse']) {
    comparisons[reference] = {};
    for (const arm of ['lite', 'full', 'ultra']) {
      const pairs = [];
      for (const cells of groups.values()) {
        if (cells[reference] && cells[arm] && cells[reference].usage.output_tokens > 0) {
          const a = cells[arm],
            b = cells[reference];
          pairs.push({
            promptId: a.promptId,
            repetition: a.repetition,
            armTokens: a.usage.output_tokens,
            referenceTokens: b.usage.output_tokens,
            relativeReduction: 1 - a.usage.output_tokens / b.usage.output_tokens,
          });
        }
      }
      const perPrompt = {};
      for (const pair of pairs) (perPrompt[pair.promptId] ||= []).push(pair);
      const armTotal = pairs.reduce((n, r) => n + r.armTokens, 0);
      const referenceTotal = pairs.reduce((n, r) => n + r.referenceTokens, 0);
      comparisons[reference][arm] = {
        sampleCount: pairs.length,
        relativeReduction: distribution(pairs.map((r) => r.relativeReduction)),
        aggregateTokenReduction: referenceTotal ? 1 - armTotal / referenceTotal : null,
        perPrompt: Object.fromEntries(
          Object.entries(perPrompt).map(([id, rows]) => [
            id,
            {
              n: rows.length,
              relativeReduction: distribution(rows.map((r) => r.relativeReduction)),
              armTokens: distribution(rows.map((r) => r.armTokens)),
              referenceTokens: distribution(rows.map((r) => r.referenceTokens)),
            },
          ])
        ),
      };
    }
  }
  const promptIds = [...new Set(records.map((r) => r.promptId))];
  const sufficient =
    promptIds.length > 0 &&
    promptIds.every((id) =>
      ARMS.every(
        (arm) =>
          successful.filter((r) => r.promptId === id && r.arm === arm).length >= minimumRepetitions
      )
    );
  return {
    schemaVersion: 1,
    complete: successful.length,
    failed: records.length - successful.length,
    minimumRepetitions,
    repeatedCoverageComplete: sufficient,
    qualityGate: 'pending paired review; token reductions do not establish quality',
    outputTokens: Object.fromEntries(
      ARMS.map((arm) => [
        arm,
        distribution(successful.filter((r) => r.arm === arm).map((r) => r.usage.output_tokens)),
      ])
    ),
    comparisons,
  };
}

function anonymize(records, prompts) {
  const pairs = [],
    key = [];
  for (const reference of ['baseline', 'terse']) {
    for (const r of records.filter(
      (r) => ['lite', 'full', 'ultra'].includes(r.arm) && r.status === 'complete'
    )) {
      const ref = records.find(
        (s) =>
          s.promptId === r.promptId &&
          s.repetition === r.repetition &&
          s.arm === reference &&
          s.status === 'complete'
      );
      if (!ref) continue;
      const id = hash(`${r.promptId}:${r.repetition}:${r.arm}:${reference}`).slice(0, 12);
      const swap = parseInt(id[0], 16) % 2 === 0;
      const ordered = swap ? [r, ref] : [ref, r];
      const prompt = prompts.find((p) => p.id === r.promptId);
      pairs.push({
        id,
        prompt: prompt.prompt,
        split: prompt.split,
        language: prompt.language,
        requiredFacts: prompt.requiredFacts,
        a: ordered[0].reply,
        b: ordered[1].reply,
        review: {
          correctness: null,
          completeness: null,
          actionability: null,
          readability: null,
          lostCriticalConstraints: [],
          rationale: null,
          reviewer: null,
          reviewType: null,
        },
      });
      key.push({
        id,
        a: ordered[0].arm,
        b: ordered[1].arm,
        promptId: r.promptId,
        repetition: r.repetition,
      });
    }
  }
  return { pairs, key };
}

module.exports = { ARMS, hash, validateResult, distribution, summarize, anonymize };
