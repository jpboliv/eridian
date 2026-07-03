const SENSITIVE_EXTENSIONS = ['.env', '.pem'];
const SENSITIVE_BASENAME_PATTERNS = [
  /^id_(rsa|ed25519|ecdsa|dsa)$/i,
  /^credentials/i,
  /^secret/i,
];
const SENSITIVE_PATH_SEGMENTS = ['.ssh', '.aws', '.gnupg'];
const SENSITIVE_NAME_TOKENS = ['apikey', 'token'];

function isSensitivePath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
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

function stripCodeBlocks(text) {
  return text.replace(/```[\s\S]*?```/g, '');
}

function countHeadings(text) {
  return (stripCodeBlocks(text).match(/^#{1,6}\s/gm) || []).length;
}

function extractCodeBlocks(text) {
  return text.match(/```[\s\S]*?```/g) || [];
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

  const originalHeadings = countHeadings(originalText);
  const draftHeadings = countHeadings(draftText);
  if (originalHeadings !== draftHeadings) {
    reasons.push(`heading count changed: original ${originalHeadings}, draft ${draftHeadings}`);
  }

  const originalBlocks = extractCodeBlocks(originalText);
  const draftBlocks = extractCodeBlocks(draftText);
  const draftBlockSet = new Set(draftBlocks);
  originalBlocks.forEach((block, index) => {
    if (!draftBlockSet.has(block)) {
      reasons.push(
        `code block dropped or altered: original block #${index + 1} not found unchanged in draft`
      );
    }
  });

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

  return { ok: reasons.length === 0, reasons, summary };
}

module.exports = { isSensitivePath, validateDraft };
