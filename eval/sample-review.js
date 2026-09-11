#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { hash, validateCollection } = require('./lib');

function sample(runDirectory) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(runDirectory, name), 'utf8'));
  const manifest = read('manifest.json'),
    prompts = read('prompts.json');
  validateCollection(manifest, prompts, read('records.json'), read('completion.json'));
  const pairs = read('paired-review.json'),
    key = read('paired-key.json');
  const selected = [];
  const ids = prompts.map((p) => p.id).sort();
  for (let index = 0; index < ids.length; index++) {
    for (const [armIndex, arm] of ['lite', 'full', 'ultra'].entries()) {
      const repetition = 1 + ((index + armIndex) % manifest.repetitions);
      const entry = key.find(
        (k) =>
          k.promptId === ids[index] &&
          k.repetition === repetition &&
          [k.a, k.b].includes('baseline') &&
          [k.a, k.b].includes(arm)
      );
      const pair = entry && pairs.find((p) => p.id === entry.id);
      if (!pair) throw new Error(`Missing complete pair ${ids[index]}:${arm}:${repetition}`);
      selected.push(pair);
    }
  }
  const out = path.join(runDirectory, `review-sample-${crypto.randomUUID()}`);
  fs.mkdirSync(out);
  const write = (name, data) =>
    fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
  write('paired-review.json', selected);
  write('selection.json', {
    schemaVersion: 1,
    sourceRun: manifest.runId,
    sourcePairHash: hash(JSON.stringify(pairs)),
    plannedPairs: pairs.length,
    selectedPairs: selected.length,
    policy:
      'one baseline comparison per prompt and dialect arm; repetitions rotate deterministically across sorted prompt IDs and arms',
    scope: 'representative model-assisted screen, not complete paired review or human acceptance',
    humanReview: 'pending',
    ids: selected.map((p) => p.id),
  });
  return out;
}
if (require.main === module) {
  try {
    if (!process.argv[2]) throw new Error('usage: node eval/sample-review.js <run-directory>');
    console.log(sample(path.resolve(process.argv[2])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { sample };
