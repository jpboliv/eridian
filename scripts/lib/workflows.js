const fs = require('node:fs');
const path = require('node:path');

function loadWorkflow(name) {
  if (!['commit', 'review'].includes(name)) throw new Error(`Unknown workflow: ${name}`);
  return fs.readFileSync(path.join(__dirname, '../../workflows', `${name}.md`), 'utf8').trim();
}

module.exports = { loadWorkflow };
