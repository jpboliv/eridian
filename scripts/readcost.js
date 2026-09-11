#!/usr/bin/env node
const fs = require('node:fs');
const { score } = require('./lib/readcost');

try {
  const args = process.argv.slice(2);
  let language = 'en';
  let file;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--language') {
      language = args[++index];
      if (!language || language.startsWith('-'))
        throw new Error('--language requires a language tag');
    } else if (file === undefined && (args[index] === '-' || !args[index].startsWith('-'))) {
      file = args[index];
    } else {
      throw new Error('usage: node scripts/readcost.js [--language en|pt] [file|-]');
    }
  }
  const text = fs.readFileSync(file && file !== '-' ? file : 0, 'utf8');
  console.log(JSON.stringify(score(text, { language }), null, 2));
} catch (error) {
  console.error(`style diagnostics: ${error.message}`);
  process.exitCode = 1;
}
