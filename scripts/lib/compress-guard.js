const fs = require('node:fs');
const path = require('node:path');

const SENSITIVE_EXTENSIONS = ['.env', '.pem'];
const SENSITIVE_BASENAME_PATTERNS = [
  /^\.env(?:\.|$)/i,
  /^id_(rsa|ed25519|ecdsa|dsa)$/i,
  /^credentials/i,
  /^secret/i,
];
const SENSITIVE_PATH_SEGMENTS = ['.ssh', '.aws', '.gnupg'];
const SENSITIVE_NAME_TOKENS = ['apikey', 'token'];

function checkPathName(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.toLowerCase().split('/').filter(Boolean);
  const basename = segments[segments.length - 1] || '';
  const basenameLower = basename.toLowerCase();

  for (const segment of SENSITIVE_PATH_SEGMENTS) {
    if (segments.includes(segment)) {
      return { ok: false, reason: `refuse: path contains sensitive directory (${segment})` };
    }
  }

  for (const ext of SENSITIVE_EXTENSIONS) {
    if (basenameLower.endsWith(ext)) {
      return { ok: false, reason: `refuse: path matches credential pattern (${ext})` };
    }
  }

  for (const pattern of SENSITIVE_BASENAME_PATTERNS) {
    if (pattern.test(basename)) {
      return {
        ok: false,
        reason: `refuse: filename matches credential pattern (${pattern.source})`,
      };
    }
  }

  for (const token of SENSITIVE_NAME_TOKENS) {
    if (basenameLower.includes(token)) {
      return { ok: false, reason: `refuse: filename contains sensitive token (${token})` };
    }
  }

  return { ok: true };
}

// Reject links in any component, including links to otherwise safe Markdown.
// Missing paths remain eligible for the command's subsequent existence check.
function isSensitivePath(filePath) {
  if (filePath.split(/[\\/]/).includes('..')) {
    return { ok: false, reason: 'refuse: parent traversal requires an explicit target path' };
  }
  for (const candidate of [filePath, path.resolve(filePath)]) {
    const result = checkPathName(candidate);
    if (!result.ok) return result;
  }
  const absolute = path.resolve(filePath);
  const { root } = path.parse(absolute);
  let current = root;
  for (const segment of absolute.slice(root.length).split(path.sep)) {
    current = path.join(current, segment);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isFile() && stat.nlink > 1) {
        return { ok: false, reason: 'refuse: target has multiple hard links' };
      }
      if (stat.isSymbolicLink()) {
        return { ok: false, reason: 'refuse: target or parent directory is a symlink' };
      }
    } catch (error) {
      if (error.code === 'ENOENT') return { ok: true };
      return { ok: false, reason: 'refuse: cannot inspect target path' };
    }
  }
  try {
    return checkPathName(fs.realpathSync(absolute));
  } catch {
    return { ok: false, reason: 'refuse: cannot resolve target path' };
  }
}

// CommonMark-style top-level fences: up to three spaces, matching character,
// closing run at least as long as the opener. Preserve whole blocks verbatim.
function parseMarkdown(text) {
  const blocks = [];
  const prose = [];
  let fence = null;
  let block = [];
  for (const line of text.split('\n')) {
    if (fence) {
      block.push(line);
      const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*\r?$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
        blocks.push(block.join('\n'));
        fence = null;
        block = [];
      }
    } else {
      const open = line.replace(/\r$/, '').match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
        fence = open[1];
        block = [line];
      } else {
        prose.push(line);
      }
    }
  }
  return { blocks, prose: prose.join('\n'), unclosed: fence !== null };
}

function countHeadings(text) {
  return (text.match(/^ {0,3}#{1,6}\s/gm) || []).length;
}

function meaningSignals(text) {
  text = text.replace(/https?:\/\/\S+/g, '');
  return {
    'negations and exceptions':
      text.match(
        /\b(?:no|not|never|without|unless|except|only|must|before|after|until|otherwise|cannot)\b|\b\w+n['’]t\b/gi
      ) || [],
    // Pair values with their immediate word/unit to catch unit substitutions.
    'numbers and units': text.match(/[+-]?\d+(?:[.,]\d+)*(?:\s*(?:%|[a-zA-Z°µ]+))?/g) || [],
    identifiers: text.match(/`+[^`\n]+`+|\b\w+(?:[_./:-]\w+)+\b|\b[a-z]+[A-Z]\w*\b/g) || [],
    // Preserve each ordered step and its order; rewriting requires manual review.
    'ordered constraints': text.match(/^\s*\d+[.)]\s+.*$/gm) || [],
  };
}

function extractUrls(text) {
  const matches = text.match(/https?:\/\/\S+/g) || [];
  return new Set(matches.map((url) => url.replace(/[),.;:'"]+$/, '')));
}

function validateDraft(originalText, draftText) {
  const reasons = [];

  if (draftText.trim().length === 0) {
    return { ok: false, reasons: ['draft is empty'], summary: null };
  }

  if (draftText === originalText) {
    reasons.push('draft is byte-identical to original');
  }

  const originalMarkdown = parseMarkdown(originalText);
  const draftMarkdown = parseMarkdown(draftText);
  if (originalMarkdown.unclosed || draftMarkdown.unclosed) {
    reasons.push('unclosed Markdown fence requires manual review');
  }
  const originalHeadings = countHeadings(originalMarkdown.prose);
  const draftHeadings = countHeadings(draftMarkdown.prose);
  if (originalHeadings !== draftHeadings) {
    reasons.push(`heading count changed: original ${originalHeadings}, draft ${draftHeadings}`);
  }

  const originalBlocks = originalMarkdown.blocks;
  const draftBlocks = draftMarkdown.blocks;
  originalBlocks.forEach((block, index) => {
    if (draftBlocks[index] !== block) {
      reasons.push(
        `code block dropped or altered: original block #${index + 1} not found unchanged in draft`
      );
    }
  });

  if (draftBlocks.length !== originalBlocks.length) {
    reasons.push('code block count changed');
  }
  const originalSignals = meaningSignals(originalMarkdown.prose);
  const draftSignals = meaningSignals(draftMarkdown.prose);
  const meaningChanges = Object.keys(originalSignals).filter(
    (category) =>
      JSON.stringify(originalSignals[category]) !== JSON.stringify(draftSignals[category])
  );
  for (const category of meaningChanges) {
    reasons.push(
      `meaning-sensitive change (${category}): restore original or review manually; automated overwrite blocked`
    );
  }

  const originalUrls = extractUrls(originalText);
  const draftUrls = extractUrls(draftText);
  originalUrls.forEach((url) => {
    if (!draftUrls.has(url)) {
      reasons.push(`url dropped: ${url}`);
    }
  });

  const summary = {
    headings: [originalHeadings, draftHeadings],
    codeBlocks: [originalBlocks.length, draftBlocks.length],
    urls: [originalUrls.size, draftUrls.size],
    chars: [originalText.length, draftText.length],
  };

  return { ok: reasons.length === 0, reasons, summary, meaningChanges };
}

module.exports = { isSensitivePath, validateDraft };
