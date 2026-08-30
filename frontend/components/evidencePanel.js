// Screen 5 -- Evidence Panel (docs/FRONTEND_PLAN.md Section 3), rendered
// inside Screen 4's case detail. One entry per advanced.evidence_entries
// item. `type` defaults to "file" when absent, matching
// scripts/evaluate_tier_b.js's checkEvidence default exactly -- older
// recorded runs (e.g. Tier A's, and the tb-1 entry predating this
// session's hardening pass) have no `type` field at all and must render
// identically to an explicit `type: "file"` entry, not be guessed at.

import { escapeHtml, verdictIcon } from '../lib/format.js';

function citation(entry) {
  const hasLines = entry.lines && entry.lines !== 'n/a';
  return hasLines ? `${entry.file}:${entry.lines}` : entry.file;
}

// Small hand-coded document/magnifying-glass icons reinforcing the
// FILE/SEARCH distinction visually, not just via the text label --
// same "hand-drawn SVG, not an icon font" discipline as
// lib/format.js's verdictIcon/emptyStateIllustration.
function typeIcon(type) {
  if (type === 'search') {
    return `<svg class="evidence-type-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="5.1" cy="5.1" r="3.4" stroke="currentColor" stroke-width="1.3" /><line x1="7.5" y1="7.5" x2="10.3" y2="10.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>`;
  }
  return `<svg class="evidence-type-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 1.3h3.4l2.1 2.1v7.3a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5V1.8a.5.5 0 01.5-.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" /><path d="M4.2 6h3.1M4.2 8h3.1" stroke="currentColor" stroke-width="1" stroke-linecap="round" /></svg>`;
}

function typeBadge(entry) {
  const type = entry.type || 'file';
  const label = type === 'search' ? 'SEARCH' : 'FILE';
  return `<span class="difficulty-tag mono evidence-entry__type">${typeIcon(type)}${label}</span>`;
}

// Verified/unverified is a real correctness signal (set by the
// independent checker, not the agent), so it's the one place in this
// panel that reuses the semantic match/mismatch colors -- never hidden
// when false, the reason is shown right next to it. The checkmark/x icon
// is the exact same verdictIcon() used on the case-detail verdict
// badges, not a second hand-drawn icon set to keep in sync.
function statusIndicator(entry) {
  if (entry.verified) {
    return `<span class="badge badge--match evidence-entry__status">${verdictIcon('match')}verified</span>`;
  }
  const reason = entry.reason ? escapeHtml(entry.reason) : 'no reason recorded';
  return `
    <span class="badge badge--mismatch evidence-entry__status">${verdictIcon('mismatch')}unverified</span>
    <span class="evidence-entry__reason">${reason}</span>
  `;
}

function evidenceEntry(entry) {
  // Card rhythm: a left-border accent by verification state (reusing the
  // existing match/mismatch meaning) so the panel has visual rhythm when
  // scanned quickly, not just when read one card at a time.
  const rhythmClass = entry.verified ? 'evidence-entry--verified' : 'evidence-entry--unverified';
  return `
    <li class="evidence-entry ${rhythmClass}">
      <div class="evidence-entry__header">
        ${typeBadge(entry)}
        <span class="mono-chip evidence-entry__citation">${escapeHtml(citation(entry))}</span>
      </div>
      <p class="evidence-entry__detail">${escapeHtml(entry.detail)}</p>
      <div class="evidence-entry__footer">
        ${statusIndicator(entry)}
      </div>
    </li>
  `;
}

export function renderEvidencePanel(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) {
    return '<p class="detail-meta">No evidence entries recorded.</p>';
  }
  return `<ul class="evidence-list">${list.map(evidenceEntry).join('')}</ul>`;
}
