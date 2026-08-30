// Screen 6 -- Baseline vs. Advanced Comparison (docs/FRONTEND_PLAN.md
// Section 3). Reuses Screen 3's getSummary() -- no independent
// computation of accuracy/cost/latency exists here.
//
// Deviation from the plan's original ASCII mockup, made deliberately and
// documented rather than silently dropped: the mockup showed "Advanced
// confirms N REACHABLE" / "Advanced clears N not-a-risk" counts. Those
// specific counts are NOT present in the summary object computed by
// lib/summary.js (mirroring scripts/evaluate.js, summary carries
// accuracy/false-positives/false-negatives/cost/latency, not a
// REACHABLE-vs-not split) -- reconstructing them would mean going back to
// each tier's raw `results` array, which the task asked this screen not
// to do. Replaced with "baseline false positives" / "advanced false
// positives", which the summary object does carry directly and which
// makes the same underlying point (what baseline gets wrong that
// advanced fixes) without recomputing anything.

import { getSummary, formatPercent, formatCost, formatDuration } from '../lib/summary.js';
import { escapeHtml } from '../lib/format.js';
import { animateBarFills, animateCountUps } from '../lib/animate.js';

const TIER_LABELS = { 'tier-a': 'Tier A', 'tier-b': 'Tier B' };

function column(tierKey, tierData) {
  if (!tierData) {
    return { label: TIER_LABELS[tierKey], summary: null };
  }
  return { label: TIER_LABELS[tierKey], summary: getSummary(tierData) };
}

function row(title, tierACell, tierBCell) {
  return `
    <tr>
      <th scope="row">${escapeHtml(title)}</th>
      <td class="mono">${tierACell}</td>
      <td class="mono">${tierBCell}</td>
    </tr>
  `;
}

function cell(summary, render) {
  return summary ? render(summary) : 'n/a';
}

// Same hand-coded SVG bar pattern as the dashboard's summary strip --
// accent-vs-muted, not match/mismatch (see styles.css's
// .accuracy-bar-fill comment for why an aggregate percentage doesn't
// borrow those three colors).
function accuracyBarsCell(summary) {
  if (!summary) return 'n/a';
  const bar = (pct, colorVar, label) => `
    <div class="accuracy-bar-row">
      <span class="accuracy-bar-row__label">${label}</span>
      <svg class="accuracy-bar-track" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="6" rx="3" style="fill: var(--color-border);" />
        <rect class="accuracy-bar-fill" width="${pct === null ? 0 : Math.round(pct * 100)}" height="6" rx="3" style="fill: ${colorVar};" />
      </svg>
      <span class="accuracy-bar-row__value" data-countup="${pct === null ? 0 : pct}" data-countup-kind="percent">${formatPercent(pct)}</span>
    </div>
  `;
  return `
    <div class="accuracy-bars">
      ${bar(summary.baseline.risk_classification_accuracy, 'var(--color-text-secondary)', 'Baseline')}
      ${bar(summary.advanced.risk_classification_accuracy, 'var(--color-accent)', 'Advanced')}
    </div>
  `;
}

const COUNT_UP_FORMATTERS = {
  percent: formatPercent,
  cost: formatCost,
  duration: formatDuration,
};

export function renderComparison(container, { tierAData, tierBData }) {
  const a = column('tier-a', tierAData);
  const b = column('tier-b', tierBData);

  container.innerHTML = `
    <div class="screen">
      <h1 class="screen-title">Baseline vs. Advanced Comparison</h1>
      <table class="comparison-table case-table">
        <thead>
          <tr>
            <th></th>
            <th>${escapeHtml(a.label)}${a.summary ? ` (n=${a.summary.total_cases})` : ''}</th>
            <th>${escapeHtml(b.label)}${b.summary ? ` (n=${b.summary.total_cases})` : ''}</th>
          </tr>
        </thead>
        <tbody>
          ${row(
            'Baseline flags',
            cell(a.summary, (s) => `${s.total_cases} VULNERABLE`),
            cell(b.summary, (s) => `${s.total_cases} VULNERABLE`)
          )}
          ${row(
            'Baseline false positives',
            cell(a.summary, (s) => s.baseline.false_positives),
            cell(b.summary, (s) => s.baseline.false_positives)
          )}
          ${row(
            'Advanced completed',
            cell(a.summary, (s) => `${s.advanced.cases_completed_ok} / ${s.total_cases}`),
            cell(b.summary, (s) => `${s.advanced.cases_completed_ok} / ${s.total_cases}`)
          )}
          ${row(
            'Advanced false positives',
            cell(a.summary, (s) => s.advanced.false_positives),
            cell(b.summary, (s) => s.advanced.false_positives)
          )}
          ${row('Accuracy (baseline vs. advanced)', accuracyBarsCell(a.summary), accuracyBarsCell(b.summary))}
          ${row(
            'Total cost (advanced)',
            cell(a.summary, (s) => formatCost(s.advanced.total_cost_usd)),
            cell(b.summary, (s) => formatCost(s.advanced.total_cost_usd))
          )}
          ${row(
            'Avg latency (advanced)',
            cell(a.summary, (s) => formatDuration(s.advanced.avg_duration_ms)),
            cell(b.summary, (s) => formatDuration(s.advanced.avg_duration_ms))
          )}
        </tbody>
      </table>
    </div>
  `;

  animateBarFills(container);
  animateCountUps(container, COUNT_UP_FORMATTERS);
}
