#!/usr/bin/env node
// Exclusive, verified backup of one instruction file into the Codex Eridian store.
// Prints `backup: <path>` on success; exits 1 without touching the target otherwise.
const fs = require('node:fs');
const path = require('node:path');
const { isSensitivePath } = require('../lib/compress-guard');
const { codexPaths } = require('../lib/host-paths');

function fail(reason) {
  console.error(`backup failed: ${reason}`);
  process.exit(1);
}

const target = process.argv[2];
if (!target) fail('usage: backup.js <target>');
const guard = isSensitivePath(target);
if (!guard.ok) fail(guard.reason);
let original;
try {
  if (!fs.lstatSync(target).isFile()) fail('refuse: target is not a regular file');
  original = fs.readFileSync(target);
} catch (error) {
  fail(error.code === 'ENOENT' ? 'target does not exist' : `cannot read target (${error.code})`);
}
let backupsDir;
try {
  backupsDir = codexPaths().backupsDir;
  fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
} catch (error) {
  fail(`cannot prepare backup directory (${error.message})`);
}
const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace(/\.\d{3}Z$/, 'Z');
const base = path.basename(target);
let file = null;
for (let attempt = 0; attempt < 100 && !file; attempt++) {
  const candidate = path.join(backupsDir, `${stamp}-${attempt ? `${attempt}-` : ''}${base}`);
  try {
    fs.writeFileSync(candidate, original, { flag: 'wx', mode: 0o600 });
    file = candidate;
  } catch (error) {
    if (error.code !== 'EEXIST') fail(`cannot write backup (${error.code})`);
  }
}
if (!file) fail('could not allocate a unique backup name');
if (!fs.readFileSync(file).equals(original)) {
  try {
    fs.unlinkSync(file);
  } catch {
    /* reported below */
  }
  fail('backup verification failed; backup removed, target untouched');
}
console.log(`backup: ${file}`);
