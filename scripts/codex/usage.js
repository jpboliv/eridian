const fs = require('node:fs');

const INPUT_VERSION = 1;

function contentCategory(content) {
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

function normalizeEvent(value, sessionId) {
  if (!value || value.version !== INPUT_VERSION || value.type !== 'assistant') return null;
  if (value.session_id !== sessionId) return null;
  const usage = value.usage || value.message?.usage;
  const id = value.id || value.message?.id;
  const model = value.model || value.message?.model || null;
  const timestamp = value.timestamp;
  const tsMs = Date.parse(timestamp);
  const outputTokens = usage?.output_tokens;
  const content = value.content || value.message?.content;
  if (!Number.isFinite(tsMs) || !Number.isFinite(outputTokens) || outputTokens < 0) return null;
  return {
    id: typeof id === 'string' && id ? id : null,
    model,
    tsMs,
    outputTokens,
    category: contentCategory(content),
    content,
  };
}

function readNormalizedEvents(file, sessionId) {
  const events = [];
  let malformed = 0;
  let unknown = 0;
  let lines;
  try {
    lines = fs.readFileSync(file, 'utf8').split('\n');
  } catch {
    return { events, malformed: 0, unknown: 0, unavailable: true };
  }
  for (const line of lines) {
    if (!line.trim()) continue;
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
  return { events, malformed, unknown, unavailable: false };
}

module.exports = { INPUT_VERSION, contentCategory, normalizeEvent, readNormalizedEvents };
