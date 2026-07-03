#!/usr/bin/env node
const { isSensitivePath } = require('./lib/compress-guard');

const target = process.argv[2];

if (!target) {
  console.log('refuse: no path given');
  process.exit(1);
}

const result = isSensitivePath(target);

if (result.ok) {
  console.log('ok');
  process.exit(0);
} else {
  console.log(result.reason);
  process.exit(1);
}
