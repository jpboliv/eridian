#!/usr/bin/env node
// Install native pet assets separately from Eridian's mode/session state.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FILES = ['pet.json', 'spritesheet.png'];
const source = path.resolve(__dirname, '../../assets/codex-pet');

function installPet(codexHome) {
  const pets = path.join(codexHome, 'pets');
  const destination = path.join(pets, 'eridian-rocky');
  const assets = FILES.map((name) => fs.readFileSync(path.join(source, name)));
  fs.mkdirSync(pets, { recursive: true });
  if (fs.lstatSync(pets).isSymbolicLink()) throw new Error('Refusing a symlinked pets directory.');
  let existing;
  try {
    existing = fs.lstatSync(destination);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    if (!existing.isDirectory() || existing.isSymbolicLink())
      throw new Error('Pet destination is not a regular directory.');
    const identical = FILES.every((name, index) => {
      const target = path.join(destination, name);
      return (
        fs.existsSync(target) &&
        fs.lstatSync(target).isFile() &&
        fs.readFileSync(target).equals(assets[index])
      );
    });
    if (!identical)
      throw new Error(
        `Pet already exists with different contents: ${destination}. Preserve or move that directory before installing.`
      );
    return destination;
  }
  const staging = fs.mkdtempSync(path.join(pets, '.eridian-rocky-'));
  try {
    FILES.forEach((name, index) =>
      fs.writeFileSync(path.join(staging, name), assets[index], { flag: 'wx', mode: 0o600 })
    );
    fs.renameSync(staging, destination);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return destination;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== 'install')
      throw new Error('Usage: node scripts/codex/pet.js install');
    const destination = installPet(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
    console.log(`Eridian Rocky installed: ${destination}`);
    console.log('In an interactive Codex CLI session, select: /pets custom:eridian-rocky');
    console.log(
      'Requires a supported graphics terminal, outside tmux/Zellij. Codex controls animation and activity states; Eridian mode and buddy speed do not control this pet.'
    );
  } catch (error) {
    console.error(`Eridian pet installation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { installPet };
