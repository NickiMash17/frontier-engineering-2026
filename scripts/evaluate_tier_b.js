'use strict';

// Tier B evaluation harness. Mirrors scripts/evaluate.js's methodology
// (baseline vs. advanced, scored against frozen ground truth, evidence
// independently re-verified) but reads cases from
// evaluation/benchmarks/tier-b/manifest.json instead of fixtures/, and
// every case in Tier B points at the SAME cloned repository directory
// (a different package/CVE is checked within it per case), rather than
// one fixture directory per case as in Tier A.
//
// IMPORTANT: this script was authored but has not been run in the
// session that wrote it -- see docs/EXPERIMENT_LOG.md Experiment 4 for
// why (an auto-mode safety classifier blocked further Bash execution in
// that line of research). Before running:
//   1. Run evaluation/benchmarks/tier-b/fetch_repos.sh to populate
//      evaluation/benchmarks/tier-b/.repo-cache/ with each pinned repo.
//   2. node scripts/evaluate_tier_b.js

const fs = require('fs');
const path = require('path');
const { isVulnerable, loadAdvisories, getInstalledVersion } = require('./baseline');
const { runAdvancedCase } = require('./advanced/run_case');

const TIER_B_ROOT = path.join(__dirname, '..', 'evaluation', 'benchmarks', 'tier-b');
const MANIFEST_PATH = path.join(TIER_B_ROOT, 'manifest.json');
const REPO_CACHE_ROOT = path.join(TIER_B_ROOT, '.repo-cache');
const RESULTS_ROOT = path.join(__dirname, '..', 'evaluation', 'results-tier-b');

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

// Same evidence-verification approach as scripts/evaluate.js -- checks
// file existence and line-count bounds, tries both a repo-root-relative
// and an absolute resolution (see docs/EXPERIMENT_LOG.md Experiment 2).
function checkEvidence(repoDir, evidence) {
  const checked = evidence.map((entry) => {
    const candidates = [path.join(repoDir, entry.file), path.resolve(entry.file)];
    const filePath = candidates.find((c) => fs.existsSync(c));
    if (!filePath) {
      return { ...entry, verified: false, reason: 'file does not exist under any resolution' };
    }
    const lineCount = fs.readFileSync(filePath, 'utf8').split('\n').length;
    const match = String(entry.lines).match(/(\d+)(?:\s*-\s*(\d+))?/);
    if (!match) return { ...entry, verified: false, reason: 'lines field not parseable' };
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    const inBounds = start >= 1 && end <= lineCount && start <= end;
    return { ...entry, verified: inBounds, reason: inBounds ? null : `out of bounds (file has ${lineCount} lines)` };
  });
  const verifiedCount = checked.filter((e) => e.verified).length;
  return { entries: checked, completeness: evidence.length === 0 ? 0 : verifiedCount / evidence.length };
}

function isRisk(verdict) {
  return verdict === 'REACHABLE';
}

async function evaluateCase(manifestCase, repositories) {
  const repo = repositories.find((r) => r.repo_id === manifestCase.repo_id);
  const repoDir = path.join(REPO_CACHE_ROOT, manifestCase.repo_id);
  if (!fs.existsSync(repoDir)) {
    throw new Error(
      `Repo cache for ${manifestCase.repo_id} not found at ${repoDir}. Run evaluation/benchmarks/tier-b/fetch_repos.sh first.`
    );
  }

  const advisories = loadAdvisories();
  const advisory = advisories.find((a) => a.cve === manifestCase.cve && a.package === manifestCase.package);
  if (!advisory) {
    throw new Error(`No advisory entry for ${manifestCase.cve} / ${manifestCase.package} in data/advisories/index.json`);
  }

  const installedVersion = getInstalledVersion(repoDir, manifestCase.package) || manifestCase.version;
  const baselineVulnerable = isVulnerable(installedVersion, advisory.vulnerable_ranges);
  const truthIsRisk = isRisk(manifestCase.expected_verdict);

  const caseContext = {
    cve: advisory.cve,
    package: advisory.package,
    installed_version: installedVersion,
    vulnerable_symbol: advisory.vulnerable_symbol,
  };
  const advancedResult = runAdvancedCase(repoDir, caseContext);

  let advancedVerdict = null;
  let evidenceCheck = { entries: [], completeness: null };
  if (advancedResult.ok) {
    advancedVerdict = advancedResult.output.verdict;
    evidenceCheck = checkEvidence(repoDir, advancedResult.output.evidence || []);
  }

  return {
    case_id: manifestCase.case_id,
    cve: manifestCase.cve,
    package: manifestCase.package,
    difficulty_category: manifestCase.difficulty_category,
    ground_truth_verdict: manifestCase.expected_verdict,
    baseline: {
      verdict: baselineVulnerable ? 'VULNERABLE' : 'NOT_VULNERABLE',
      predicts_risk: baselineVulnerable,
      correct_risk_classification: baselineVulnerable === truthIsRisk,
    },
    advanced: {
      ok: advancedResult.ok,
      error: advancedResult.error || null,
      verdict: advancedVerdict,
      exact_verdict_match: advancedResult.ok ? advancedVerdict === manifestCase.expected_verdict : false,
      predicts_risk: advancedResult.ok ? isRisk(advancedVerdict) : null,
      correct_risk_classification: advancedResult.ok ? isRisk(advancedVerdict) === truthIsRisk : null,
      confidence: advancedResult.ok ? advancedResult.output.confidence : null,
      evidence_completeness: evidenceCheck.completeness,
      evidence_entries: evidenceCheck.entries,
      full_output: advancedResult.ok ? advancedResult.output : null,
      total_cost_usd: advancedResult.total_cost_usd,
      duration_ms: advancedResult.duration_ms,
      permission_denials: advancedResult.permission_denials,
    },
  };
}

async function main() {
  const manifest = loadManifest();
  console.error(`Evaluating ${manifest.cases.length} Tier B cases against ${manifest.repositories.length} repo(s).`);

  const results = [];
  for (const c of manifest.cases) {
    console.error(`  running ${c.case_id} ...`);
    // eslint-disable-next-line no-await-in-loop
    const result = await evaluateCase(c, manifest.repositories);
    console.error(
      `    ground truth=${result.ground_truth_verdict} baseline=${result.baseline.verdict} advanced=${result.advanced.verdict || result.advanced.error}`
    );
    results.push(result);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(RESULTS_ROOT, timestamp);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify({ results }, null, 2));
  console.log(JSON.stringify({ results_path: path.join(runDir, 'results.json') }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
