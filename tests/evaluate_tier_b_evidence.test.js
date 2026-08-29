'use strict';

// Regression test for the evidence-completeness gap found in Tier B
// (docs/EXPERIMENT_LOG.md Experiment 5): a search-method citation (e.g.
// "repo-wide grep for require('underscore')") was marked unverified
// because the checker only knew how to validate file+line locations.
// checkEvidence now recognizes an optional "type": "search" entry as a
// distinct, valid evidence category. File-based checking (the default,
// backward-compatible path) must behave exactly as before.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { checkEvidence } = require('../scripts/evaluate_tier_b');

const REPO_DIR = path.join(__dirname, '..', 'fixtures', 'case-a-reachable-minimist');

test('a "search" entry is verified without touching the filesystem', () => {
  const evidence = [
    {
      type: 'search',
      file: "repo-wide grep for require('underscore')",
      lines: 'n/a',
      detail: 'No other file in the repository references underscore.',
    },
  ];
  const result = checkEvidence(REPO_DIR, evidence);
  assert.equal(result.completeness, 1);
  assert.equal(result.entries[0].verified, true);
  assert.equal(result.entries[0].reason, null);
});

test('an entry with no "type" field defaults to file-based checking (backward compatible)', () => {
  const evidence = [{ file: 'src/server.js', lines: '1-16', detail: 'entry point' }];
  const result = checkEvidence(REPO_DIR, evidence);
  assert.equal(result.entries[0].verified, true);
});

test('an explicit "type": "file" entry is checked exactly like an entry with no type field', () => {
  const evidenceNoType = [{ file: 'src/server.js', lines: '1-16', detail: 'entry point' }];
  const evidenceExplicitType = [{ type: 'file', file: 'src/server.js', lines: '1-16', detail: 'entry point' }];
  const noType = checkEvidence(REPO_DIR, evidenceNoType).entries[0];
  const explicitType = checkEvidence(REPO_DIR, evidenceExplicitType).entries[0];
  assert.equal(noType.verified, explicitType.verified);
});

test('a "file" entry citing a nonexistent path is still marked unverified (unchanged behavior)', () => {
  const evidence = [{ file: 'src/does-not-exist.js', lines: '1-5', detail: 'bogus' }];
  const result = checkEvidence(REPO_DIR, evidence);
  assert.equal(result.entries[0].verified, false);
  assert.match(result.entries[0].reason, /does not exist/);
});

test('a mix of file and search entries computes completeness across both', () => {
  const evidence = [
    { file: 'src/server.js', lines: '1-16', detail: 'entry point' },
    { type: 'search', file: "grep for 'minimist'", lines: 'n/a', detail: 'only one call site found' },
    { file: 'src/does-not-exist.js', lines: '1-5', detail: 'bogus' },
  ];
  const result = checkEvidence(REPO_DIR, evidence);
  assert.equal(result.completeness, 2 / 3);
});
