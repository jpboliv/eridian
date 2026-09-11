const lexicon = require('./readcost-lexicon');

const wordPattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const words = (text) => text.match(wordPattern) || [];
const count = (text, pattern) => (text.match(pattern) || []).length;

function withoutCode(text) {
  let fence = null;
  const lines = text
    .split(/\r?\n/)
    .map((line) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (fence) {
        if (
          marker &&
          marker[1][0] === fence.char &&
          marker[1].length >= fence.length &&
          !marker[2].trim()
        )
          fence = null;
        return '';
      }
      if (marker) {
        fence = { char: marker[1][0], length: marker[1].length };
        return '';
      }
      if (/^(?: {4}|\t)/.test(line)) return '';
      return line;
    })
    .join('\n');
  // Only equal-length delimiter runs can close an inline code span.
  const runs = [...lines.matchAll(/`+/g)];
  let result = '';
  let cursor = 0;
  for (let index = 0; index < runs.length; index++) {
    const opener = runs[index];
    const closerIndex = runs.findIndex(
      (run, candidate) => candidate > index && run[0].length === opener[0].length
    );
    if (closerIndex < 0) continue;
    result += lines.slice(cursor, opener.index) + ' ';
    cursor = runs[closerIndex].index + runs[closerIndex][0].length;
    index = closerIndex;
  }
  return result + lines.slice(cursor);
}

function withoutQuotes(text) {
  return text
    .replace(/^ {0,3}>.*$/gm, '')
    .replace(/"[^"]*"|“[^”]*”|«[^»]*»/g, ' ')
    .replace(
      /(?<![\p{L}\p{N}])'(?:[^'\n]|(?<=[\p{L}\p{N}])'(?=[\p{L}\p{N}]))+'(?![\p{L}\p{N}])|‘(?:[^’]|(?<=[\p{L}\p{N}])’(?=[\p{L}\p{N}]))*’/gu,
      ' '
    );
}

function lexicalCounts(text) {
  const candidates = [];
  for (const [category, phrases] of Object.entries(lexicon)) {
    for (const phrase of phrases) {
      const escaped = phrase
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/ /g, '\\s+')
        .replace(/'/g, "['’]");
      const before = /^[\p{L}\p{N}_]/u.test(phrase) ? '(?<![\\p{L}\\p{N}_])' : '';
      const after = /[\p{L}\p{N}_]$/u.test(phrase) ? '(?![\\p{L}\\p{N}_])' : '';
      const pattern = new RegExp(`${before}${escaped}${after}`, 'giu');
      for (const match of text.matchAll(pattern))
        candidates.push({ category, start: match.index, end: match.index + match[0].length });
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  const counts = Object.fromEntries(Object.keys(lexicon).map((category) => [category, 0]));
  let end = -1;
  for (const match of candidates) {
    if (match.start < end) continue;
    counts[match.category]++;
    end = match.end;
  }
  return counts;
}

function score(text, { language = 'en' } = {}) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (typeof language !== 'string' || !language.trim())
    throw new TypeError('language must be a nonempty language tag');
  language = language.trim().toLowerCase();
  const lexicalSupported = /^en(?:-|$)/.test(language);
  const prose = withoutQuotes(withoutCode(text));
  const proseWords = words(prose).length;
  const sentences = prose.split(/[.!?]+(?:\s|$)|\n+/).filter((part) => words(part).length);
  const counts = {
    ...Object.fromEntries(Object.keys(lexicon).map((category) => [category, null])),
    headers:
      count(prose, /^ {0,3}#{1,6}\s+\S.*$/gm) + count(prose, /^.+\n {0,3}(?:={3,}|-{3,})\s*$/gm),
    boldLabelBullets: count(prose, /^\s*(?:[-+*]|\d+[.)])\s+\*\*[^*\n]+\*\*\s*:?/gm),
    emojiBullets: count(prose, /^\s*(?:(?:[-+*]|\d+[.)])\s+)?\p{Extended_Pictographic}/gmu),
    tables: count(prose, /^ {0,3}\|?\s*:?-{3,}:?\s*\|(?:\s*:?-{3,}:?\s*\|?)+\s*$/gm),
  };
  if (lexicalSupported) Object.assign(counts, lexicalCounts(prose));
  // Rocky markers describe persona usage, not avoidable filler.
  const phraseMatches = lexicalSupported
    ? counts.filler + counts.preambles + counts.recaps + counts.salesLanguage
    : null;
  return {
    schemaVersion: 1,
    label: 'style diagnostics',
    language,
    lexicalSupported,
    proseWords,
    sentences: sentences.length,
    longSentences: sentences.filter((sentence) => words(sentence).length > 30).length,
    counts,
    phraseMatches,
    phraseMatchRatePer100ProseWords:
      lexicalSupported && proseWords > 0 ? (phraseMatches * 100) / proseWords : null,
  };
}

module.exports = { score, SCHEMA_VERSION: 1 };
