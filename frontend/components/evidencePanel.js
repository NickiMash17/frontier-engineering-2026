// Screen 5 -- Evidence Panel (docs/FRONTEND_PLAN.md Section 3), rendered
// inside Screen 4's case detail. One entry per advanced.evidence_entries
// item. `type` defaults to "file" when absent, matching
// scripts/evaluate_tier_b.js's checkEvidence default exactly -- older
// recorded runs (e.g. Tier A's, and the tb-1 entry predating this
// session's hardening pass) have no `type` field at all and must render
// identically to an explicit `type: "file"` entry, not be guessed at.

import { escapeHtml } from '../lib/format.js';

function citation(entry) {
  const hasLines = entry.lines && entry.lines !== 'n/a';
  return hasLines ? `${entry.file}:${entry.lines}` : entry.file;
}

function typeBadge(entry) {
  const type = entry.type || 'file';
  const label = type === 'search' ? 'SEARCH' : 'FILE';
  return `<span class="difficulty-tag mono evidence-entry__type">${label}</span>`;
}

// Verified/unverified is a real correctness signal (set by the
// independent checker, not the agent), so it's the one place in this
// panel that reuses the semantic match/mismatch colors -- never hidden
// when false, the reason is shown right next to it.
function statusIndicator(entry) {
  if (entry.verified) {
    return `<span class="badge badge--match evidence-entry__status">verified</span>`;
  }
  const reason = entry.reason ? escapeHtml(entry.reason) : 'no reason recorded';
  return `
    <span class="badge badge--mismatch evidence-entry__status">unverified</span>
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
