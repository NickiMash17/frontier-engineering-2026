'use strict';

// Generates frontend/data/generated/{tier-a,tier-b}.latest.js from the
// most recent real evaluation run under evaluation/results/ and
// evaluation/results-tier-b/. Plain ES modules (`export const ... = {...}`)
// so frontend/index.html can `import` real data directly -- see
// docs/FRONTEND_PLAN.md Section 1 for why this still requires a static
// server (ES module imports are blocked under file://; this script does
// not change that).
//
// Deliberately not a bundler: this is a ~60-line, dependency-free script
// that copies real JSON into a JS-literal wrapper, nothing more. No
// number here is synthesized -- if no real run exists yet for a tier,
// this script says so loudly and does not write a placeholder file.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(REPO_ROOT, 'frontend', 'data', 'generated');

const SOURCES = [
  {
    label: 'Tier A',
    resultsRoot: path.join(REPO_ROOT, 'evaluation', 'results'),
    exportName: 'TIER_A',
    outFile: 'tier-a.latest.js',
  },
  {
    label: 'Tier B',
    resultsRoot: path.join(REPO_ROOT, 'evaluation', 'results-tier-b'),
    exportName: 'TIER_B',
    outFile: 'tier-b.latest.js',
  },
];

// Timestamped run directories look like 2026-08-29T13-12-24-798Z, which
// sorts correctly with a plain string comparison -- no date parsing
// needed. Only directories are considered (evaluation/results/ has been
// observed to also contain stray non-run files alongside real run
// directories).
function findLatestRunDir(resultsRoot) {
  if (!fs.existsSync(resultsRoot)) return null;
  const entries = fs
    .readdirSync(resultsRoot)
    .filter((name) => fs.statSync(path.join(resultsRoot, name)).isDirectory())
    .sort();
  if (entries.length === 0) return null;
  return path.join(resultsRoot, entries[entries.length - 1]);
}

function generateOne({ label, resultsRoot, exportName, outFile }) {
  const runDir = findLatestRunDir(resultsRoot);
  if (!runDir) {
    console.error(`[generate_data] No run directory found under ${resultsRoot} for ${label} -- skipping ${outFile}. Not writing a placeholder.`);
    return { label, ok: false };
  }

  const resultsPath = path.join(runDir, 'results.json');
  if (!fs.existsSync(resultsPath)) {
    console.error(`[generate_data] ${resultsPath} does not exist -- skipping ${outFile}. Not writing a placeholder.`);
    return { label, ok: false };
  }

  const raw = fs.readFileSync(resultsPath, 'utf8');
  const data = JSON.parse(raw); // fails loudly on malformed real data, never silently substitutes

  const sourceRelPath = path.relative(REPO_ROOT, resultsPath).split(path.sep).join('/');
  const header = [
    '// GENERATED FILE -- do not hand-edit.',
    `// Source: ${sourceRelPath}`,
    `// Generated: ${new Date().toISOString()}`,
    '// Regenerate with: node scripts/frontend/generate_data.js',
    '',
  ].join('\n');

  const body = `export const ${exportName} = ${JSON.stringify(data, null, 2)};\n`;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, outFile), header + body);
  console.error(`[generate_data] ${label}: wrote ${path.join('frontend', 'data', 'generated', outFile)} from ${sourceRelPath}`);
  return { label, ok: true, sourceRelPath };
}

function main() {
  const results = SOURCES.map(generateOne);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`[generate_data] Completed with ${failed.length} tier(s) skipped (see above). This is not a crash -- a missing tier is a real, reportable state, not an error to hide.`);
  }
}

module.exports = { findLatestRunDir, generateOne };

if (require.main === module) {
  main();
}
