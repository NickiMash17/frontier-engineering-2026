'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { isVulnerable, loadAdvisories, runBaseline } = require('../scripts/baseline');

test('isVulnerable handles the real, disjoint minimist ranges correctly', () => {
  const ranges = [
    { introduced: '0', fixed: '0.2.1' },
    { introduced: '1.0.0', fixed: '1.2.3' },
  ];
  assert.equal(isVulnerable('0.0.1', ranges), true);
  assert.equal(isVulnerable('0.2.1', ranges), false, 'fixed boundary is exclusive');
  assert.equal(isVulnerable('0.5.0', ranges), false, 'the gap between the two ranges is not vulnerable');
  assert.equal(isVulnerable('1.2.0', ranges), true);
  assert.equal(isVulnerable('1.2.3', ranges), false, 'fixed boundary is exclusive');
});

test('advisories index loads and matches the two CVEs this project uses', () => {
  const advisories = loadAdvisories();
  const cves = advisories.map((a) => a.cve).sort();
  assert.deepEqual(cves, ['CVE-2019-10744', 'CVE-2020-7598']);
});

test('baseline flags every Tier A fixture as VULNERABLE (it is code-blind by design)', () => {
  const fixturesRoot = path.join(__dirname, '..', 'fixtures');
  const caseIds = [
    'case-a-reachable-minimist',
    'case-b-unreachable-minimist',
    'case-c-condition-not-satisfied-lodash',
    'case-d-indirect-minimist',
  ];
  for (const caseId of caseIds) {
    const results = runBaseline(path.join(fixturesRoot, caseId));
    assert.equal(results.length, 1, `${caseId} should match exactly one advisory`);
    assert.equal(
      results[0].baseline_verdict,
      'VULNERABLE',
      `${caseId} installs a genuinely vulnerable version by construction`
    );
  }
});
