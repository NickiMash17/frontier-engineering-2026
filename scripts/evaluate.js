'use strict';

// Evaluation harness (Phase 5): runs baseline and advanced against every
// Tier A fixture, scores both against the hand-authored ground_truth.json
// in each fixture (never against the advanced agent's own self-reported
// confidence), and writes machine-readable results plus a human-readable
// summary. No number in the summary is computed anywhere except here.

const fs = require('fs');
const path = require('path');
const { runBaseline, loadAdvisories } = require('./baseline');
const { runAdvancedCase } = require('./advanced/run_case');

const FIXTURES_ROOT = path.join(__dirname, '..', 'fixtures');
const RESULTS_ROOT = path.join(__dirname, '..', 'evaluation', 'results');

function listFixtureCases() {
  return fs
    .readdirSync(FIXTURES_ROOT)
    .filter((name) => fs.statSync(path.join(FIXTURES_ROOT, name)).isDirectory())
    .sort();
}

function loadGroundTruth(fixtureDir) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, 'ground_truth.json'), 'utf8'));
}

// Verifies every evidence citation the advanced agent made actually
// exists on disk in the fixture -- this is the "evaluate independently of
// the agent's own claims" requirement. Checks file existence and that the
// claimed line range is within the file's actual line count; does not
// re-verify semantic content of the citation (that would require another
// LLM judgment call, which defeats the point of an independent check).
const REPO_ROOT = path.join(__dirname, '..');

function resolveEvidenceFile(fixtureDir, citedFile) {
  // The prompt asks for a path "relative to the repository root" (the
  // fixture directory), but in practice the agent sometimes reports paths
  // relative to this Claude Code session's own cwd instead (which, when
  // the evaluation harness is run from the monorepo root, is
  // "fixtures/<case-id>/<...>"). Both are valid descriptions of the same
  // real file, so both are tried -- this was found and fixed during
  // Day-1 evaluation (see docs/EXPERIMENT_LOG.md Experiment 2); it is a
  // prompt/harness ambiguity, not an agent reasoning error.
  const candidates = [
    path.join(fixtureDir, citedFile),
    path.join(REPO_ROOT, citedFile),
    path.resolve(citedFile),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function checkEvidence(fixtureDir, evidence) {
  const checked = evidence.map((entry) => {
    const filePath = resolveEvidenceFile(fixtureDir, entry.file);
    if (!filePath) {
      return { ...entry, verified: false, reason: 'file does not exist under any resolution' };
    }
    const lineCount = fs.readFileSync(filePath, 'utf8').split('\n').length;
    const match = String(entry.lines).match(/(\d+)(?:\s*-\s*(\d+))?/);
    if (!match) {
      return { ...entry, verified: false, reason: 'lines field not parseable' };
    }
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    const inBounds = start >= 1 && end <= lineCount && start <= end;
    return {
      ...entry,
      verified: inBounds,
      reason: inBounds ? null : `line range ${start}-${end} out of bounds (file has ${lineCount} lines)`,
    };
  });
  const verifiedCount = checked.filter((e) => e.verified).length;
  return {
    entries: checked,
    completeness: evidence.length === 0 ? 0 : verifiedCount / evidence.length,
  };
}

function isRisk(verdict) {
  return verdict === 'REACHABLE';
}

async function evaluateCase(caseId) {
  const fixtureDir = path.join(FIXTURES_ROOT, caseId);
  const groundTruth = loadGroundTruth(fixtureDir);
  const advisories = loadAdvisories();

  const baselineResults = runBaseline(fixtureDir);
  const baselineRecord = baselineResults.find((r) => r.cve === groundTruth.cve);
  if (!baselineRecord) {
    throw new Error(`No baseline record for ${groundTruth.cve} in ${caseId}`);
  }

  const advisory = advisories.find((a) => a.cve === groundTruth.cve);
  const caseContext = { ...advisory, installed_version: baselineRecord.installed_version };

  const advancedResult = runAdvancedCase(fixtureDir, caseContext);

  const baselinePredictsRisk = baselineRecord.baseline_verdict === 'VULNERABLE';
  const truthIsRisk = isRisk(groundTruth.verdict);

  let advancedVerdict = null;
  let advancedPredictsRisk = null;
  let evidenceCheck = { entries: [], completeness: null };
  let exactMatch = false;

  if (advancedResult.ok) {
    advancedVerdict = advancedResult.output.verdict;
    advancedPredictsRisk = isRisk(advancedVerdict);
    evidenceCheck = checkEvidence(fixtureDir, advancedResult.output.evidence || []);
    exactMatch = advancedVerdict === groundTruth.verdict;
  }

  return {
    case_id: caseId,
    cve: groundTruth.cve,
    ground_truth_verdict: groundTruth.verdict,
    baseline: {
      verdict: baselineRecord.baseline_verdict,
      predicts_risk: baselinePredictsRisk,
      correct_risk_classification: baselinePredictsRisk === truthIsRisk,
    },
    advanced: {
      ok: advancedResult.ok,
      error: advancedResult.error || null,
      verdict: advancedVerdict,
      exact_verdict_match: exactMatch,
      predicts_risk: advancedPredictsRisk,
      correct_risk_classification: advancedResult.ok ? advancedPredictsRisk === truthIsRisk : null,
      confidence: advancedResult.ok ? advancedResult.output.confidence : null,
      evidence_completeness: evidenceCheck.completeness,
      evidence_entries: evidenceCheck.entries,
      uncertainties: advancedResult.ok ? advancedResult.output.uncertainties : null,
      total_cost_usd: advancedResult.total_cost_usd,
      duration_ms: advancedResult.duration_ms,
      full_output: advancedResult.ok ? advancedResult.output : null,
      permission_denials: advancedResult.permission_denials,
    },
  };
}

function summarize(caseResults) {
  const n = caseResults.length;
  const baselineCorrect = caseResults.filter((c) => c.baseline.correct_risk_classification).length;
  const baselineFalsePositives = caseResults.filter(
    (c) => c.baseline.predicts_risk && !isRisk(c.ground_truth_verdict)
  ).length;
  const baselineFalseNegatives = caseResults.filter(
    (c) => !c.baseline.predicts_risk && isRisk(c.ground_truth_verdict)
  ).length;

  const advancedOk = caseResults.filter((c) => c.advanced.ok);
  const advancedExactMatches = advancedOk.filter((c) => c.advanced.exact_verdict_match).length;
  const advancedRiskCorrect = advancedOk.filter((c) => c.advanced.correct_risk_classification).length;
  const advancedFalsePositives = advancedOk.filter(
    (c) => c.advanced.predicts_risk && !isRisk(c.ground_truth_verdict)
  ).length;
  const advancedFalseNegatives = advancedOk.filter(
    (c) => !c.advanced.predicts_risk && isRisk(c.ground_truth_verdict)
  ).length;
  const totalCost = advancedOk.reduce((sum, c) => sum + (c.advanced.total_cost_usd || 0), 0);
  const totalDuration = advancedOk.reduce((sum, c) => sum + (c.advanced.duration_ms || 0), 0);
  const evidenceCompletenessValues = advancedOk
    .map((c) => c.advanced.evidence_completeness)
    .filter((v) => v !== null);
  const avgEvidenceCompleteness =
    evidenceCompletenessValues.length === 0
      ? null
      : evidenceCompletenessValues.reduce((a, b) => a + b, 0) / evidenceCompletenessValues.length;

  return {
    total_cases: n,
    baseline: {
      risk_classification_accuracy: baselineCorrect / n,
      false_positives: baselineFalsePositives,
      false_negatives: baselineFalseNegatives,
    },
    advanced: {
      cases_completed_ok: advancedOk.length,
      cases_errored: n - advancedOk.length,
      exact_verdict_accuracy: advancedOk.length === 0 ? null : advancedExactMatches / advancedOk.length,
      risk_classification_accuracy: advancedOk.length === 0 ? null : advancedRiskCorrect / advancedOk.length,
      false_positives: advancedFalsePositives,
      false_negatives: advancedFalseNegatives,
      avg_evidence_completeness: avgEvidenceCompleteness,
      total_cost_usd: totalCost,
      avg_duration_ms: advancedOk.length === 0 ? null : totalDuration / advancedOk.length,
    },
  };
}

async function main() {
  const caseIds = listFixtureCases();
  console.error(`Evaluating ${caseIds.length} Tier A cases: ${caseIds.join(', ')}`);

  const results = [];
  for (const caseId of caseIds) {
    console.error(`  running ${caseId} ...`);
    // Sequential, not parallel: keeps per-case cost/latency logging legible
    // and avoids concurrent CLI invocations competing for the same budget
    // caps during Day-1 validation.
    // eslint-disable-next-line no-await-in-loop
    const result = await evaluateCase(caseId);
    console.error(
      `    ground truth=${result.ground_truth_verdict} baseline=${result.baseline.verdict} advanced=${result.advanced.verdict || result.advanced.error}`
    );
    results.push(result);
  }

  const summary = summarize(results);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(RESULTS_ROOT, timestamp);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify({ summary, results }, null, 2));

  console.log(JSON.stringify({ summary, results_path: path.join(runDir, 'results.json') }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
