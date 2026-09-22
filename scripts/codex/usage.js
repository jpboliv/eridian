const fs = require('node:fs');
const { category } = require('../lib/accounting-core');

const INPUT_VERSION = 1;
const MAX_LINE_BYTES = 1024 * 1024;

function normalizeEvent(value, sessionId) {
  if (!value || value.version !== INPUT_VERSION || value.type !== 'assistant') return null;
  if (value.session_id !== sessionId) return null;
  const usage = value.usage || value.message?.usage;
  const id = value.id || value.message?.id;
  const model = value.model || value.message?.model || null;
  const tsMs = Date.parse(value.timestamp);
  const outputTokens = usage?.output_tokens;
  const content = value.content || value.message?.content;
  if (!Number.isFinite(tsMs) || !Number.isFinite(outputTokens) || outputTokens < 0) return null;
  return {
    id: typeof id === 'string' && id ? id : null,
    model,
    tsMs,
    outputTokens,
    category:
      usage.output_tokens_details?.thinking_tokens > 0 ? 'protected-or-mixed' : category(content),
    content,
  };
}

function readNormalizedEvents(file, sessionId) {
  const events = [];
  let malformed = 0;
  let unknown = 0;
  let oversized = 0;
  let lines;
  try {
    lines = fs.readFileSync(file, 'utf8').split('\n');
  } catch {
    return { events, malformed, unknown, oversized, unavailable: true };
  }
  for (const line of lines) {
    if (!line.trim()) continue;
    if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
      oversized++;
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      malformed++;
      continue;
    }
    const event = normalizeEvent(parsed, sessionId);
    if (event) events.push(event);
    else unknown++;
  }
  return { events, malformed, unknown, oversized, unavailable: false };
}

module.exports = { INPUT_VERSION, MAX_LINE_BYTES, normalizeEvent, readNormalizedEvents };
