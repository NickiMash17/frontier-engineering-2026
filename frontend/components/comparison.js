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
import { animateBarFills, animateCountUps, animateArrowDraw } from '../lib/animate.js';
import { renderAccuracyBars } from './accuracyBars.js';
import { renderAmbientBg } from './ambientBg.js';

const TIER_LABELS = { 'tier-a': 'Tier A', 'tier-b': 'Tier B' };

function column(tierKey, tierData) {
  if (!tierData) {
    return { label: TIER_LABELS[tierKey], summary: null };
  }
  return { label: TIER_LABELS[tierKey], summary: getSummary(tierData) };
}

// The headline moment this screen exists to show: baseline accuracy ->
// advanced accuracy, per tier, in the single largest type on the page,
// with a line-draw arrow connecting them (same stroke-dasharray/
// -dashoffset technique as the trace diagram, see traceDiagram.js) --
// ties this screen back to the product's own visual language rather than
// reading as a plain data table with a headline bolted on.
function compareHeroItem(tierKey, summary) {
  if (!summary) return '';
  const baseline = summary.baseline.risk_classification_accuracy;
  const advanced = summary.advanced.risk_classification_accuracy;
  return `
    <div class="compare-hero__item">
      <span class="compare-hero__label">${escapeHtml(TIER_LABELS[tierKey])}</span>
      <div class="compare-hero__numbers">
        <span class="compare-hero__before mono" data-countup="${baseline === null ? 0 : baseline}" data-countup-kind="percent">${formatPercent(baseline)}</span>
        <svg class="compare-hero__arrow" viewBox="0 0 60 24" aria-hidden="true">
          <path d="M2 12 H48 M40 5 L52 12 L40 19" class="compare-hero__arrow-path" />
        </svg>
        <span class="compare-hero__after glow-number mono" data-countup="${advanced === null ? 0 : advanced}" data-countup-kind="percent">${formatPercent(advanced)}</span>
      </div>
    </div>
  `;
}

function compareHero(aSummary, bSummary) {
  const items = [compareHeroItem('tier-a', aSummary), compareHeroItem('tier-b', bSummary)].filter(Boolean);
  if (items.length === 0) return '';
  return `<div class="compare-hero">${items.join('')}</div>`;
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

const COUNT_UP_FORMATTERS = {
  percent: formatPercent,
  cost: formatCost,
  duration: formatDuration,
};

export function renderComparison(container, { tierAData, tierBData }) {
  const a = column('tier-a', tierAData);
  const b = column('tier-b', tierBData);

  container.innerHTML = `
    <div class="ambient-host">
      ${renderAmbientBg()}
      <div class="screen">
        <h1 class="screen-title">Baseline vs. Advanced Comparison</h1>
        ${compareHero(a.summary, b.summary)}
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
            ${row(
              'Accuracy (baseline vs. advanced)',
              cell(a.summary, (s) => renderAccuracyBars(s, 'cmp-a')),
              cell(b.summary, (s) => renderAccuracyBars(s, 'cmp-b'))
            )}
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
    </div>
  `;

  animateBarFills(container);
  animateCountUps(container, COUNT_UP_FORMATTERS);
  animateArrowDraw(container);
}
