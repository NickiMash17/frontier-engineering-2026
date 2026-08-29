// Screen 3 -- Results Dashboard (docs/FRONTEND_PLAN.md Section 3).

import { getSummary, formatPercent, formatCost, formatDuration } from '../lib/summary.js';
import { escapeHtml, badge, neutralBadge, advancedBadgeKind, baselineBadgeKind } from '../lib/format.js';

const TIER_LABELS = { 'tier-a': 'Tier A', 'tier-b': 'Tier B' };

function tierTabs(activeTier) {
  return `
    <nav class="tier-tabs">
      ${Object.entries(TIER_LABELS)
        .map(
          ([key, label]) =>
            `<a href="#/dashboard/${key}" class="tier-tab${key === activeTier ? ' tier-tab--active' : ''}">${label}</a>`
        )
        .join('')}
    </nav>
  `;
}

function summaryStrip(summary) {
  return `
    <div class="summary-strip">
      <div class="summary-card card">
        <div class="summary-card__label">Accuracy</div>
        <div class="summary-card__value">
          <span class="mono">${formatPercent(summary.baseline.risk_classification_accuracy)}</span>
          <span class="summary-card__arrow">&rarr;</span>
          <span class="mono">${formatPercent(summary.advanced.risk_classification_accuracy)}</span>
        </div>
        <div class="summary-card__sub">baseline &rarr; advanced</div>
      </div>
      <div class="summary-card card">
        <div class="summary-card__label">False Positives</div>
        <div class="summary-card__value">
          <span class="mono">${summary.baseline.false_positives}</span>
          <span class="summary-card__arrow">&rarr;</span>
          <span class="mono">${summary.advanced.false_positives}</span>
        </div>
        <div class="summary-card__sub">of ${summary.total_cases} case(s)</div>
      </div>
      <div class="summary-card card">
        <div class="summary-card__label">Total Cost</div>
        <div class="summary-card__value mono">${formatCost(summary.advanced.total_cost_usd)}</div>
        <div class="summary-card__sub">advanced only -- baseline is free</div>
      </div>
      <div class="summary-card card">
        <div class="summary-card__label">Avg Latency</div>
        <div class="summary-card__value mono">${formatDuration(summary.advanced.avg_duration_ms)}</div>
        <div class="summary-card__sub">per case, advanced only</div>
      </div>
    </div>
  `;
}

function caseRow(tier, result) {
  const verdictLabel = result.advanced.ok ? result.advanced.verdict : 'FAILED';
  // Tier B carries `package` at the top level; Tier A does not (see
  // docs/FRONTEND_PLAN.md Section 4) -- fall back to the agent's own
  // reported package name when available.
  const packageName = result.package || (result.advanced.ok ? result.advanced.full_output?.package : null);
  const idLabel = [result.cve, packageName].filter(Boolean).join(' / ');
  return `
    <tr class="case-row" data-href="#/case/${tier}/${encodeURIComponent(result.case_id)}" tabindex="0">
      <td class="mono">${escapeHtml(result.case_id)}</td>
      <td class="mono">${escapeHtml(idLabel)}</td>
      <td>${neutralBadge(result.ground_truth_verdict)}</td>
      <td>${badge(baselineBadgeKind(result.baseline), result.baseline.verdict)}</td>
      <td>${badge(advancedBadgeKind(result.advanced), verdictLabel)}</td>
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
        </tr>
      </thead>
      <tbody>
        ${results.map((r) => caseRow(tier, r)).join('')}
      </tbody>
    </table>
  `;
}

function missingDataNotice(tier) {
  return `
    <div class="card notice">
      <p>No data loaded for ${escapeHtml(TIER_LABELS[tier])}.</p>
      <p class="mono">Run <code>node scripts/frontend/generate_data.js</code> to generate
      <code>frontend/data/generated/${tier === 'tier-a' ? 'tier-a' : 'tier-b'}.latest.js</code>
      from the most recent real evaluation run, then reload.</p>
    </div>
  `;
}

export function renderDashboard(container, { tier, tierData }) {
  if (!tierData) {
    container.innerHTML = `
      <div class="screen">
        ${tierTabs(tier)}
        ${missingDataNotice(tier)}
      </div>
    `;
    attachRowHandlers(container);
    return;
  }

  const summary = getSummary(tierData);

  container.innerHTML = `
    <div class="screen">
      ${tierTabs(tier)}
      <h1 class="screen-title">Results Dashboard -- ${escapeHtml(TIER_LABELS[tier])}</h1>
      ${summaryStrip(summary)}
      ${caseTable(tier, tierData.results)}
    </div>
  `;
  attachRowHandlers(container);
}

function attachRowHandlers(container) {
  container.querySelectorAll('.case-row').forEach((row) => {
    const go = () => {
      window.location.hash = row.dataset.href.slice(1);
    };
    row.addEventListener('click', go);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  });
}
