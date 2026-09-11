const fs = require('node:fs');
const path = require('node:path');
const fixtures = require('./fixtures.json');

function validate(report, fixture) {
  const errors = [];
  if (!report || !['found', 'no-match', 'incomplete'].includes(report.status))
    return ['invalid status'];
  if (
    !Array.isArray(report.findings) ||
    !Array.isArray(report.searched) ||
    !report.searched.length ||
    !Array.isArray(report.limitations)
  )
    return ['missing findings, searched scope, or limitations'];
  if (report.status !== fixture.expectedStatus)
    errors.push('status does not match fixture evidence');
  for (const finding of report.findings) {
    const source = fixture.files[finding.path];
    if (
      !source ||
      !Number.isInteger(finding.line) ||
      finding.line < 1 ||
      typeof finding.symbol !== 'string' ||
      !finding.symbol ||
      typeof finding.evidence !== 'string' ||
      !finding.evidence ||
      !['confirmed', 'inferred'].includes(finding.confidence)
    ) {
      errors.push('invalid finding');
      continue;
    }
    const line = source.split('\n')[finding.line - 1];
    if (!line || !line.includes(finding.evidence))
      errors.push('evidence does not occur at declared line');
  }
  for (const symbol of fixture.requiredSymbols) {
    if (!report.findings.some((finding) => finding.symbol === symbol))
      errors.push(`missing symbol ${symbol}`);
  }
  if (report.status === 'no-match' && report.findings.length)
    errors.push('no-match includes findings');
  if (
    report.status === 'incomplete' &&
    !report.limitations.some((s) => typeof s === 'string' && s.trim())
  )
    errors.push('uncertainty omitted');
  return errors;
}

if (require.main === module) {
  const [id, file] = process.argv.slice(2);
  const fixture = fixtures.find((item) => item.id === id);
  try {
    if (!fixture || !file)
      throw new Error('usage: node eval/crew/contract.js <fixture-id> <report.json>');
    const report = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    const errors = validate(report, fixture);
    console.log(
      JSON.stringify(
        {
          fixture: id,
          errors,
          semanticReview: 'required; fixture checks are not proof of useful investigation',
        },
        null,
        2
      )
    );
    if (errors.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { validate };
