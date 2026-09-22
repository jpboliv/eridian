const test = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../eval/crew/contract');
const fixtures = require('../eval/crew/fixtures.json');
const definition = require('../eval/crew/investigator.json');

test('experimental investigator packaging is read-only and not a shipped preset', () => {
  assert.deepEqual(definition.tools, ['Read', 'Grep', 'Glob']);
  assert.match(definition.prompt, /Do not edit files, spawn agents/);
});

test('fixture review verifies actual paths/lines/evidence and missing matches', () => {
  const report = {
    status: 'found',
    searched: ['src/total.js', 'src/cart.js'],
    limitations: [],
    findings: [
      {
        path: 'src/total.js',
        line: 1,
        symbol: 'total',
        evidence: 'function total(items)',
        confidence: 'confirmed',
      },
      {
        path: 'src/cart.js',
        line: 2,
        symbol: 'checkout',
        evidence: 'return total(items)',
        confidence: 'confirmed',
      },
    ],
  };
  assert.deepEqual(validate(report, fixtures[0]), []);
  assert.ok(
    validate({ ...report, findings: [{ ...report.findings[0], line: 99 }] }, fixtures[0]).length
  );
  assert.deepEqual(
    validate(
      {
        status: 'no-match',
        findings: [],
        searched: ['src/pay.js'],
        limitations: ['Supplied scope only'],
      },
      fixtures[1]
    ),
    []
  );
});

test('uncertain runtime dispatch cannot be reported as confirmed exhaustive knowledge', () => {
  const report = {
    status: 'incomplete',
    searched: ['src/dispatch.js'],
    limitations: [],
    findings: [
      {
        path: 'src/dispatch.js',
        line: 1,
        symbol: 'dispatch',
        evidence: 'function dispatch',
        confidence: 'confirmed',
      },
    ],
  };
  assert.ok(validate(report, fixtures[2]).includes('uncertainty omitted'));
  report.limitations.push('The runtime key and handler map were not provided.');
  assert.deepEqual(validate(report, fixtures[2]), []);
});

test('fixture checker rejects fabricated symbols and malformed report entries', () => {
  const report = {
    status: 'found',
    searched: ['src/total.js'],
    limitations: [],
    findings: ['total', 'checkout'].map((symbol) => ({
      path: 'src/total.js',
      line: 2,
      evidence: 'module.exports',
      symbol,
      confidence: 'confirmed',
    })),
  };
  assert.ok(validate(report, fixtures[0]).includes('symbol does not occur at declared line'));
  assert.ok(validate({ ...report, findings: [null] }, fixtures[0]).includes('invalid finding'));
  assert.ok(
    validate(
      { status: 'no-match', searched: [null], findings: [], limitations: [] },
      fixtures[1]
    ).includes('invalid searched scope')
  );
});
