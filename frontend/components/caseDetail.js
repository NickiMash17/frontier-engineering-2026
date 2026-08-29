// Screen 4 -- CVE Investigation Detail, the hero screen
// (docs/FRONTEND_PLAN.md Section 3). Must check advanced.ok first and
// never assume full_output/verdict/evidence_entries exist when it's
// false -- see the "Must handle advanced.ok === false explicitly" note
// in the plan.

import { formatPercent, formatCost, formatDuration } from '../lib/summary.js';
import { escapeHtml, badge, neutralBadge, advancedBadgeKind, baselineBadgeKind } from '../lib/format.js';

const TIER_LABELS = { 'tier-a': 'Tier A', 'tier-b': 'Tier B' };

function backLink(tier) {
  return `<a href="#/dashboard/${tier}" class="back-link">&larr; Back to ${escapeHtml(TIER_LABELS[tier])} dashboard</a>`;
}

function notFound(tier, caseId) {
  return `
    <div class="screen">
      ${backLink(tier)}
      <div class="card notice">
        <p>No case named <span class="mono">${escapeHtml(caseId)}</span> in ${escapeHtml(TIER_LABELS[tier])}.</p>
      </div>
    </div>
  `;
}

function verdictRow(result) {
  const advancedLabel = result.advanced.ok ? result.advanced.verdict : 'FAILED';
  return `
    <div class="verdict-row">
      <div class="verdict-cell">
        <div class="verdict-cell__label">Ground Truth</div>
        ${neutralBadge(result.ground_truth_verdict)}
      </div>
      <div class="verdict-cell">
        <div class="verdict-cell__label">Baseline</div>
        ${badge(baselineBadgeKind(result.baseline), result.baseline.verdict)}
      </div>
      <div class="verdict-cell">
        <div class="verdict-cell__label">Advanced</div>
        ${badge(advancedBadgeKind(result.advanced), advancedLabel)}
      </div>
    </div>
  `;
}

function difficultyTags(categories) {
  if (!Array.isArray(categories) || categories.length === 0) return '';
  return `
    <div class="difficulty-tags">
      ${categories.map((c) => `<span class="difficulty-tag mono">${escapeHtml(c)}</span>`).join('')}
    </div>
  `;
}

// The distinct "investigation failed" state -- styled differently from a
// genuine UNCERTAIN verdict so the two are never confused, and never
// reaching for full_output/evidence_entries/reachable_path, all of which
// are null/absent here.
function failedInvestigation(advanced) {
  return `
    <div class="card notice notice--failed">
      <div class="notice__title">Investigation failed</div>
      <p class="mono">${escapeHtml(advanced.error || 'unknown error')}</p>
      <p class="detail-meta">The advanced agent did not produce a verdict for this case -- this is not the
      same thing as an honest UNCERTAIN verdict, and is shown separately from one.</p>
    </div>
  `;
}

function successfulInvestigation(tier, result) {
  const { advanced } = result;
  const output = advanced.full_output || {};
  const reachablePath = Array.isArray(output.reachable_path) ? output.reachable_path : [];
  const requiredConditions = Array.isArray(output.required_conditions) ? output.required_conditions : [];
  const evidenceCount = Array.isArray(advanced.evidence_entries) ? advanced.evidence_entries.length : 0;

  return `
    <div class="detail-meta-row">
      <span>Confidence: <span class="mono">${advanced.confidence != null ? advanced.confidence.toFixed(2) : 'n/a'}</span></span>
      <span>Evidence completeness: <span class="mono">${formatPercent(advanced.evidence_completeness)}</span></span>
      <span>Cost: <span class="mono">${formatCost(advanced.total_cost_usd)}</span></span>
      <span>Duration: <span class="mono">${formatDuration(advanced.duration_ms)}</span></span>
      <span>Attacker-controlled input: <span class="mono">${String(output.attacker_controlled_input)}</span></span>
    </div>

    <div class="detail-section">
      <h2 class="detail-section__title">Reachable Path</h2>
      ${
        reachablePath.length
          ? `<ol class="path-list">${reachablePath.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
          : '<p class="detail-meta">(empty -- consistent with a NOT_REACHABLE verdict)</p>'
      }
    </div>

    <div class="detail-section">
      <h2 class="detail-section__title">Required Conditions</h2>
      ${
        requiredConditions.length
          ? `<ul class="path-list">${requiredConditions.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`
          : '<p class="detail-meta">(none stated)</p>'
      }
    </div>

    <div class="card notice">
      <p class="mono">${evidenceCount} evidence entr${evidenceCount === 1 ? 'y' : 'ies'} recorded.</p>
      <p class="detail-meta">Full evidence panel (Screen 5) not yet built -- see docs/FRONTEND_PLAN.md Section 3.</p>
    </div>
  `;
}

export function renderCaseDetail(container, { tier, tierData, caseId }) {
  if (!tierData) {
    container.innerHTML = `
      <div class="screen">
        ${backLink(tier)}
        <div class="card notice"><p>No data loaded for ${escapeHtml(TIER_LABELS[tier])}.</p></div>
      </div>
    `;
    return;
  }

  const result = tierData.results.find((r) => r.case_id === caseId);
  if (!result) {
    container.innerHTML = notFound(tier, caseId);
    return;
  }

  // Tier B carries `package` at the top level; Tier A does not (see
  // docs/FRONTEND_PLAN.md Section 4), so fall back to the agent's own
  // reported package name from full_output when available.
  const output = result.advanced.ok ? result.advanced.full_output : null;
  const packageName = result.package || output?.package;
  const headerRight = [packageName, output?.installed_version].filter(Boolean).join('@');

  container.innerHTML = `
    <div class="screen">
      ${backLink(tier)}
      <div class="detail-header">
        <h1 class="screen-title mono">${escapeHtml(result.cve)}</h1>
        ${headerRight ? `<span class="mono detail-header__package">${escapeHtml(headerRight)}</span>` : ''}
      </div>
      ${difficultyTags(result.difficulty_category)}
      ${verdictRow(result)}
      ${result.advanced.ok ? successfulInvestigation(tier, result) : failedInvestigation(result.advanced)}
    </div>
  `;
}
