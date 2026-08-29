'use strict';

// Baseline: the conventional "package-version" vulnerability triage
// approach used by common SCA tools (npm audit, Dependabot, etc.) --
// match the installed version of a dependency against known-vulnerable
// ranges from a public advisory database. No code awareness whatsoever:
// if the version falls in the vulnerable range, the package is flagged,
// full stop, regardless of whether the application ever calls it.

const fs = require('fs');
const path = require('path');
const { lessThan } = require('./version');

const ADVISORIES_PATH = path.join(__dirname, '..', 'data', 'advisories', 'index.json');

function loadAdvisories() {
  return JSON.parse(fs.readFileSync(ADVISORIES_PATH, 'utf8'));
}

function getInstalledVersion(fixtureDir, packageName) {
  const manifestPath = path.join(fixtureDir, 'node_modules', packageName, 'package.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return manifest.version;
}

function isVulnerable(installedVersion, ranges) {
  // `ranges` is a list of { introduced, fixed } SEMVER intervals, taken
  // directly from the advisory's real OSV.dev "affected[].ranges" data.
  // Some real advisories (e.g. GHSA-vh95-rmgr-6w4m / CVE-2020-7598) are
  // genuinely disjoint -- two separate vulnerable branches with two
  // separate fixes -- so membership is checked against every listed
  // range, not just one.
  return ranges.some((range) => {
    const aboveIntroduced = range.introduced === '0' || !lessThan(installedVersion, range.introduced);
    const belowFixed = lessThan(installedVersion, range.fixed);
    return aboveIntroduced && belowFixed;
  });
}

// Runs the baseline against a single fixture directory. Returns one
// record per advisory whose package is actually installed in the fixture
// (fixtures in this benchmark always install the advisory's package, but
// the check is real, not assumed).
function runBaseline(fixtureDir) {
  const advisories = loadAdvisories();
  const results = [];

  for (const advisory of advisories) {
    const installedVersion = getInstalledVersion(fixtureDir, advisory.package);
    if (installedVersion === null) continue; // package not present at all

    const vulnerable = isVulnerable(installedVersion, advisory.vulnerable_ranges);
    results.push({
      cve: advisory.cve,
      package: advisory.package,
      installed_version: installedVersion,
      vulnerable_ranges: advisory.vulnerable_ranges,
      severity: advisory.severity,
      baseline_verdict: vulnerable ? 'VULNERABLE' : 'NOT_VULNERABLE',
    });
  }

  return results;
}

module.exports = { runBaseline, loadAdvisories, getInstalledVersion, isVulnerable };

// CLI mode: `node scripts/baseline.js <fixtureDir>` prints JSON results
// for that one fixture, or with no argument, runs across every directory
// under fixtures/.
if (require.main === module) {
  const target = process.argv[2];
  if (target) {
    console.log(JSON.stringify(runBaseline(path.resolve(target)), null, 2));
  } else {
    const fixturesRoot = path.join(__dirname, '..', 'fixtures');
    const cases = fs.readdirSync(fixturesRoot).filter((name) =>
      fs.statSync(path.join(fixturesRoot, name)).isDirectory()
    );
    const all = {};
    for (const caseId of cases) {
      all[caseId] = runBaseline(path.join(fixturesRoot, caseId));
    }
    console.log(JSON.stringify(all, null, 2));
  }
}
