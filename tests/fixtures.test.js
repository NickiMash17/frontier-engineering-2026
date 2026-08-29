'use strict';

// Validates the Tier A benchmark's own internal consistency -- ground
// truth is deterministic, hand-authored, and every citation in it points
// at a real file. This is not testing the LLM agent (that costs money and
// is covered by scripts/evaluate.js instead); it is testing that the
// benchmark itself is well-formed.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FIXTURES_ROOT = path.join(__dirname, '..', 'fixtures');
const VALID_VERDICTS = new Set(['REACHABLE', 'NOT_REACHABLE', 'CONDITION_NOT_SATISFIED', 'UNCERTAIN']);

function listFixtureCases() {
  return fs
    .readdirSync(FIXTURES_ROOT)
    .filter((name) => fs.statSync(path.join(FIXTURES_ROOT, name)).isDirectory());
}

for (const caseId of listFixtureCases()) {
  test(`${caseId}: ground_truth.json is well-formed`, () => {
    const gtPath = path.join(FIXTURES_ROOT, caseId, 'ground_truth.json');
    assert.ok(fs.existsSync(gtPath), 'ground_truth.json must exist');
    const gt = JSON.parse(fs.readFileSync(gtPath, 'utf8'));

    assert.equal(gt.case_id, caseId);
    assert.match(gt.cve, /^CVE-\d{4}-\d+$/);
    assert.ok(VALID_VERDICTS.has(gt.verdict), `verdict "${gt.verdict}" must be one of the defined enum values`);
    assert.equal(typeof gt.attacker_controlled_input, 'boolean');
    assert.ok(gt.rationale && gt.rationale.length > 0);
    assert.ok(Array.isArray(gt.authoritative_evidence) && gt.authoritative_evidence.length > 0);
  });

  test(`${caseId}: authoritative_evidence citations point at real files`, () => {
    const gtPath = path.join(FIXTURES_ROOT, caseId, 'ground_truth.json');
    const gt = JSON.parse(fs.readFileSync(gtPath, 'utf8'));
    const fixtureDir = path.join(FIXTURES_ROOT, caseId);

    for (const entry of gt.authoritative_evidence) {
      const filePath = path.join(fixtureDir, entry.file);
      assert.ok(fs.existsSync(filePath), `${entry.file} cited in ground truth must exist`);
      const lineCount = fs.readFileSync(filePath, 'utf8').split('\n').length;
      const [, startStr, endStr] = String(entry.lines).match(/(\d+)(?:-(\d+))?/);
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : start;
      assert.ok(start >= 1 && end <= lineCount, `${entry.file} lines ${entry.lines} must be in bounds (file has ${lineCount} lines)`);
    }
  });

  test(`${caseId}: package.json declares the CVE-affected package at the pinned version`, () => {
    const fixtureDir = path.join(FIXTURES_ROOT, caseId);
    const gt = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'ground_truth.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'package.json'), 'utf8'));
    assert.equal(manifest.dependencies[gt.package], gt.installed_version);
  });
}
