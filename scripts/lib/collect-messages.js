const fs = require('node:fs');
const path = require('node:path');

function collectMessages(dir) {
  const messages = [];
  let sessions = 0;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { messages, sessions };
  }
  for (const project of entries.filter((e) => e.isDirectory())) {
    const projectDir = path.join(dir, project.name);
    for (const file of fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'))) {
      sessions += 1;
      const lines = fs.readFileSync(path.join(projectDir, file), 'utf8').split('\n');
      const sessionMessages = [];
      let sessionStartMs = Infinity;
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const tsMs = Date.parse(obj?.timestamp);
          if (Number.isFinite(tsMs) && tsMs < sessionStartMs) sessionStartMs = tsMs;
          const tokens = obj?.message?.usage?.output_tokens;
          if (obj.type === 'assistant' && Number.isFinite(tsMs) && tokens > 0) {
            sessionMessages.push({ tsMs, outputTokens: tokens });
          }
        } catch {
          /* skip malformed lines */
        }
      }
      for (const m of sessionMessages) {
        messages.push({ ...m, sessionStartMs });
      }
    }
  }
  return { messages, sessions };
}

module.exports = { collectMessages };
