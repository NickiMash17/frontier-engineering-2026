'use strict';

// Validates the Tier B manifest's own internal consistency -- same spirit
// as tests/fixtures.test.js for Tier A. Does not require the repo cache to
// be populated (it only checks the manifest's shape and cross-references
// against data/advisories/index.json, not the actual cloned source).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadAdvisories } = require('../scripts/baseline');

const MANIFEST_PATH = path.join(__dirname, '..', 'evaluation', 'benchmarks', 'tier-b', 'manifest.json');
const VALID_VERDICTS = new Set(['REACHABLE', 'NOT_REACHABLE', 'CONDITION_NOT_SATISFIED', 'UNCERTAIN']);

test('manifest.json exists and parses', () => {
  assert.ok(fs.existsSync(MANIFEST_PATH));
  JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
});

test('every case references a declared repository', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const repoIds = new Set(manifest.repositories.map((r) => r.repo_id));
  for (const c of manifest.cases) {
    assert.ok(repoIds.has(c.repo_id), `${c.case_id} references undeclared repo_id ${c.repo_id}`);
  }
});

test('every case has a valid expected_verdict and a matching advisory entry', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const advisories = loadAdvisories();
  for (const c of manifest.cases) {
    assert.ok(VALID_VERDICTS.has(c.expected_verdict), `${c.case_id} has invalid expected_verdict ${c.expected_verdict}`);
    const advisory = advisories.find((a) => a.cve === c.cve && a.package === c.package);
    assert.ok(advisory, `${c.case_id}: no advisory entry for ${c.cve} / ${c.package} in data/advisories/index.json`);
  }
});

test('REACHABLE cases declare a non-empty reachable_path and attacker_control true', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  for (const c of manifest.cases) {
    if (c.expected_verdict === 'REACHABLE') {
      assert.ok(c.reachable_path.length > 0, `${c.case_id}: REACHABLE case must document a reachable_path`);
      assert.equal(c.attacker_control, true, `${c.case_id}: REACHABLE case must declare attacker_control`);
    }
  }
});

test('NOT_REACHABLE cases declare an empty reachable_path', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  for (const c of manifest.cases) {
    if (c.expected_verdict === 'NOT_REACHABLE') {
      assert.equal(c.reachable_path.length, 0, `${c.case_id}: NOT_REACHABLE case should have an empty reachable_path`);
    }
  }
});

test('manifest documents at least one gap rather than silently under-covering categories', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  assert.ok(Array.isArray(manifest.documented_gaps) && manifest.documented_gaps.length > 0);
  for (const gap of manifest.documented_gaps) {
    assert.ok(gap.category && gap.reason, 'each documented gap must state category and reason');
  }
});
