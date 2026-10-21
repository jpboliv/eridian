#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function install(target) {
  if (!target)
    throw new Error('Usage: node scripts/opencode/install.js <OpenCode config directory>');
  const source = path.resolve(__dirname, '../../adapters/opencode/plugin.mjs');
  const directory = path.resolve(target, 'plugins');
  const file = path.join(directory, 'eridian.js');
  const content = `// Eridian loader. Keep the source checkout at its installed path.\nexport { EridianPlugin } from ${JSON.stringify(pathToFileURL(source).href)};\n`;
  fs.mkdirSync(directory, { recursive: true });
  try {
    fs.writeFileSync(file, content, { flag: 'wx' });
  } catch (error) {
    if (
      error.code !== 'EEXIST' ||
      fs.lstatSync(file).isSymbolicLink() ||
      fs.readFileSync(file, 'utf8') !== content
    )
      throw new Error(`Refusing to replace existing loader: ${file}`, { cause: error });
  }
  return file;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3)
      throw new Error('Usage: node scripts/opencode/install.js <OpenCode config directory>');
    console.log(`Installed Eridian loader: ${install(process.argv[2])}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { install };
