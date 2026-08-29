// Shared helpers for turning a raw results array into the summary strip
// numbers (Screen 3) and the per-case verdict comparisons (Screen 4).
// Tier A's results.json ships a precomputed `summary` object (written by
// scripts/evaluate.js); Tier B's does not (scripts/evaluate_tier_b.js
// never added one -- see docs/FRONTEND_PLAN.md Section 4). computeSummary
// mirrors scripts/evaluate.js's summarize() formulas exactly, so a
// computed Tier B summary and a shipped Tier A summary mean the same
// thing and are safe to show side by side.

export function isRisk(verdict) {
  return verdict === 'REACHABLE';
}

// Accepts either a full results.json object ({ summary?, results }) and
// returns a summary in the same shape scripts/evaluate.js's `summary`
// field uses -- using the shipped one when present (Tier A), computing it
// from `results` when absent (Tier B).
export function getSummary(data) {
  if (data && data.summary) return data.summary;
  return computeSummary((data && data.results) || []);
}

export function computeSummary(results) {
  const n = results.length;
  const baselineCorrect = results.filter((c) => c.baseline.correct_risk_classification).length;
  const baselineFalsePositives = results.filter(
    (c) => c.baseline.predicts_risk && !isRisk(c.ground_truth_verdict)
  ).length;
  const baselineFalseNegatives = results.filter(
    (c) => !c.baseline.predicts_risk && isRisk(c.ground_truth_verdict)
  ).length;

  const advancedOk = results.filter((c) => c.advanced.ok);
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
  const completenessValues = advancedOk
    .map((c) => c.advanced.evidence_completeness)
    .filter((v) => v !== null && v !== undefined);
  const avgCompleteness =
    completenessValues.length === 0 ? null : completenessValues.reduce((a, b) => a + b, 0) / completenessValues.length;

  return {
    total_cases: n,
    baseline: {
      risk_classification_accuracy: n === 0 ? null : baselineCorrect / n,
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
      avg_evidence_completeness: avgCompleteness,
      total_cost_usd: totalCost,
      avg_duration_ms: advancedOk.length === 0 ? null : totalDuration / advancedOk.length,
    },
  };
}

export function formatPercent(fraction) {
  if (fraction === null || fraction === undefined) return 'n/a';
  return `${Math.round(fraction * 100)}%`;
}

export function formatCost(usd) {
  if (usd === null || usd === undefined) return 'n/a';
  return `$${usd.toFixed(4)}`;
}

export function formatDuration(ms) {
  if (ms === null || ms === undefined) return 'n/a';
  return `${(ms / 1000).toFixed(1)}s`;
}
