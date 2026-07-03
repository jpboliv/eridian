#!/usr/bin/env node
const fs = require('node:fs');
const { validateDraft } = require('./lib/compress-guard');

const [originalPath, draftPath] = process.argv.slice(2);

if (!originalPath || !draftPath) {
  console.log('FAIL');
  console.log('usage: validate-compress.js <original-path> <draft-path>');
  process.exit(1);
}

let originalText;
let draftText;

try {
  originalText = fs.readFileSync(originalPath, 'utf8');
} catch {
  console.log('FAIL');
  console.log(`cannot read original: ${originalPath}`);
  process.exit(1);
}

try {
  draftText = fs.readFileSync(draftPath, 'utf8');
} catch {
  console.log('FAIL');
  console.log(`cannot read draft: ${draftPath}`);
  process.exit(1);
}

const result = validateDraft(originalText, draftText);

if (result.ok) {
  const { headings, codeBlocks, urls, chars } = result.summary;
  const pct = chars[0] > 0 ? (((chars[0] - chars[1]) / chars[0]) * 100).toFixed(1) : '0.0';
  console.log(
    `PASS headings ${headings[1]}/${headings[0]}, ` +
      `code-blocks ${codeBlocks[1]}/${codeBlocks[0]}, ` +
      `urls ${urls[1]}/${urls[0]}, ` +
      `${chars[0]} -> ${chars[1]} chars (-${pct}%)`
  );
  process.exit(0);
} else {
  console.log('FAIL');
  result.reasons.forEach((reason) => console.log(reason));
  process.exit(1);
}
