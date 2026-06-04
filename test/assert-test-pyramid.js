/**
 * Enforces backend test pyramid budget: >=75% unit cases, <=25% integration.
 * Counts `it(` blocks (same heuristic as Jest suites).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIN_UNIT_SHARE = 0.75;
const MAX_INTEGRATION_SHARE = 0.25;

function walk(dir, matcher, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, matcher, acc);
      continue;
    }
    if (matcher(fullPath)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function countTests(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const matches = source.match(/\bit\s*\(/g);
  return matches ? matches.length : 0;
}

const unitFiles = walk(path.join(ROOT, 'src'), (file) => file.endsWith('.spec.ts'));
const integrationFiles = walk(
  path.join(ROOT, 'test', 'integration'),
  (file) => file.endsWith('.integration.spec.ts'),
);

const unitCases = unitFiles.reduce((sum, file) => sum + countTests(file), 0);
const integrationCases = integrationFiles.reduce(
  (sum, file) => sum + countTests(file),
  0,
);
const total = unitCases + integrationCases;
const unitShare = unitCases / total;
const integrationShare = integrationCases / total;

const summary = [
  `Unit: ${unitCases} cases in ${unitFiles.length} files`,
  `Integration: ${integrationCases} cases in ${integrationFiles.length} files`,
  `Share: ${(unitShare * 100).toFixed(1)}% unit / ${(integrationShare * 100).toFixed(1)}% integration`,
  `Budget: >=${MIN_UNIT_SHARE * 100}% unit, <=${MAX_INTEGRATION_SHARE * 100}% integration`,
].join('\n');

if (unitShare < MIN_UNIT_SHARE || integrationShare > MAX_INTEGRATION_SHARE) {
  console.error(`${summary}\n\nTest pyramid budget exceeded.`);
  process.exit(1);
}

console.log(`Test pyramid OK.\n${summary}`);
