// Screen 3 -- Results Dashboard (docs/FRONTEND_PLAN.md Section 3).
// Tier tabs and the compare link now live in the persistent header
// (components/header.js) -- this screen renders only what's specific to
// one tier: the summary strip and the case table.

import { getSummary, formatPercent, formatCost, formatDuration } from '../lib/summary.js';
import { escapeHtml, badge, neutralBadge, advancedBadgeKind, baselineBadgeKind, emptyStateIllustration } from '../lib/format.js';
import { animateBarFills, animateCountUps } from '../lib/animate.js';

const TIER_LABELS = { 'tier-a': 'Tier A', 'tier-b': 'Tier B' };

// Hand-coded SVG bar pair (baseline vs. advanced), real proportions, no
// charting library. Deliberately accent-vs-muted, not match/mismatch --
// see the .accuracy-bar-fill comment in styles.css for why.
function accuracyBars(summary) {
  const baselinePct = summary.baseline.risk_classification_accuracy;
  const advancedPct = summary.advanced.risk_classification_accuracy;
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
      ${bar(baselinePct, 'var(--color-text-secondary)', 'Baseline')}
      ${bar(advancedPct, 'var(--color-accent)', 'Advanced')}
    </div>
  `;
}

function summaryStrip(summary) {
  return `
    <div class="summary-strip">
      <div class="summary-card card">
        <div class="summary-card__label">Accuracy</div>
        ${accuracyBars(summary)}
        <div class="summary-card__sub">baseline vs. advanced</div>
      </div>
      <div class="summary-card card">
        <div class="summary-card__label">False Positives</div>
        <div class="summary-card__value">
          <span class="mono">${summary.baseline.false_positives}</span>
          <span class="summary-card__arrow">→</span>
          <span class="mono">${summary.advanced.false_positives}</span>
        </div>
        <div class="summary-card__sub">of ${summary.total_cases} case(s)</div>
      </div>
      <div class="summary-card card">
        <div class="summary-card__label">Total Cost</div>
        <div class="summary-card__value mono" data-countup="${summary.advanced.total_cost_usd}" data-countup-kind="cost">${formatCost(summary.advanced.total_cost_usd)}</div>
        <div class="summary-card__sub">advanced only -- baseline is free</div>
      </div>
      <div class="summary-card card">
        <div class="summary-card__label">Avg Latency</div>
        <div class="summary-card__value mono" data-countup="${summary.advanced.avg_duration_ms || 0}" data-countup-kind="duration">${formatDuration(summary.advanced.avg_duration_ms)}</div>
        <div class="summary-card__sub">per case, advanced only</div>
      </div>
    </div>
  `;
}

function caseRow(tier, result, index) {
  const verdictLabel = result.advanced.ok ? result.advanced.verdict : 'FAILED';
  // Tier B carries `package` at the top level; Tier A does not (see
  // docs/FRONTEND_PLAN.md Section 4) -- fall back to the agent's own
  // reported package name when available.
  const packageName = result.package || (result.advanced.ok ? result.advanced.full_output?.package : null);
  const idLabel = [result.cve, packageName].filter(Boolean).join(' / ');
  // Stagger: each row fades/slides in ~30ms after the previous, capped so
  // a long case list doesn't drag the reveal out.
  const staggerMs = Math.min(index * 30, 300);
  return `
    <tr class="case-row case-row--stagger" style="animation-delay: ${staggerMs}ms"
        data-href="#/case/${tier}/${encodeURIComponent(result.case_id)}" tabindex="0">
      <td class="mono-chip">${escapeHtml(result.case_id)}</td>
      <td class="mono">${escapeHtml(idLabel)}</td>
      <td>${neutralBadge(result.ground_truth_verdict)}</td>
      <td>${badge(baselineBadgeKind(result.baseline), result.baseline.verdict)}</td>
      <td>${badge(advancedBadgeKind(result.advanced), verdictLabel)}</td>
      <td>
        <a href="#/replay/${tier}/${encodeURIComponent(result.case_id)}" class="replay-row-link" data-replay-link
           aria-label="Replay investigation for ${escapeHtml(result.case_id)}">▶ Replay</a>
      </td>
    </tr>
  `;
}

function caseTable(tier, results) {
  return `
    <table class="case-table">
      <thead>
        <tr>
          <th>Case</th>
          <th>CVE / Package</th>
          <th>Ground Truth</th>
          <th>Baseline</th>
          <th>Advanced</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${results.map((r, i) => caseRow(tier, r, i)).join('')}
      </tbody>
    </table>
  `;
}

function missingDataNotice(tier) {
  return `
    <div class="card notice empty-state">
      ${emptyStateIllustration()}
      <p>No data loaded for ${escapeHtml(TIER_LABELS[tier])}.</p>
      <p class="mono">Run <code>node scripts/frontend/generate_data.js</code> to generate
      <code>frontend/data/generated/${tier === 'tier-a' ? 'tier-a' : 'tier-b'}.latest.js</code>
      from the most recent real evaluation run, then reload.</p>
    </div>
  `;
}

const COUNT_UP_FORMATTERS = {
  percent: formatPercent,
  cost: formatCost,
  duration: formatDuration,
};

export function renderDashboard(container, { tier, tierData }) {
  if (!tierData) {
    container.innerHTML = `
      <div class="screen">
        ${missingDataNotice(tier)}
      </div>
    `;
    return;
  }

  const summary = getSummary(tierData);

  container.innerHTML = `
    <div class="screen">
      <h1 class="screen-title">Results Dashboard -- ${escapeHtml(TIER_LABELS[tier])}</h1>
      ${summaryStrip(summary)}
      ${caseTable(tier, tierData.results)}
    </div>
  `;
  attachRowHandlers(container);
  animateBarFills(container);
  animateCountUps(container, COUNT_UP_FORMATTERS);
}

// Row click/Enter/Space navigates to case detail; the per-row "Replay"
// link is its own destination and must not also trigger that (it's
// inside the row, so its click would otherwise bubble). Arrow keys and
// j/k move focus between rows -- small, but reads as a real product
// rather than a static page.
function attachRowHandlers(container) {
  const rows = Array.from(container.querySelectorAll('.case-row'));

  rows.forEach((row) => {
    const go = () => {
      window.location.hash = row.dataset.href.slice(1);
    };
    row.addEventListener('click', go);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const next = rows[rows.indexOf(row) + 1];
        if (next) next.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prev = rows[rows.indexOf(row) - 1];
        if (prev) prev.focus();
      }
    });

    const replayLink = row.querySelector('[data-replay-link]');
    if (replayLink) {
      replayLink.addEventListener('click', (e) => e.stopPropagation());
    }
  });
}
