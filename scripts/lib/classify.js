const QUESTION_START =
  /^(who|what|why|how|when|where|which|is|are|am|can|could|does|do|did|should|would|will)\b/i;
const BUGFIX = /\b(bug|fix|error|broken|breaks|crash|fail|failing|failed|regression)\b/i;
const BUILD = /\b(add|build|create|implement|make|write|scaffold|generate)\b/i;

function classifyPrompt(text) {
  const t = String(text || '').trim();
  if (/\?\s*$/.test(t) || QUESTION_START.test(t)) return 'question';
  if (BUGFIX.test(t)) return 'bugfix';
  if (BUILD.test(t)) return 'build';
  return 'other';
}

module.exports = { classifyPrompt };
