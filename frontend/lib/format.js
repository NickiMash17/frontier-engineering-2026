// Small shared rendering helpers used by every screen. Kept separate from
// lib/summary.js (which is pure number-crunching) because this file is
// about turning values into safe, styled HTML strings.

// Agent-generated text (evidence `detail`, `error` messages, etc.) is
// free-form prose from an LLM, not markup -- it must never be trusted as
// HTML. Every dynamic string interpolated into a template literal that
// becomes innerHTML goes through this first.
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Renders one of the three semantic badge states from Section 6 of
// docs/FRONTEND_PLAN.md -- 'match' (green), 'mismatch' (red), 'uncertain'
// (amber). No other meaning ever borrows these colors.
export function badge(kind, label) {
  const kindClass = { match: 'badge--match', mismatch: 'badge--mismatch', uncertain: 'badge--uncertain' }[kind] || '';
  return `<span class="badge ${kindClass}">${escapeHtml(label)}</span>`;
}

// The neutral, reference badge used for ground truth -- deliberately not
// one of the three semantic colors above (ground truth isn't "correct"
// or "incorrect" relative to anything, it's the answer key).
export function neutralBadge(label) {
  return `<span class="badge">${escapeHtml(label)}</span>`;
}

// Classifies an advanced result against ground truth for badge coloring.
// A failed invocation (advanced.ok === false) is its own case, distinct
// from a genuine UNCERTAIN verdict -- see docs/FRONTEND_PLAN.md's
// required advanced.ok handling.
export function advancedBadgeKind(advanced) {
  if (!advanced.ok) return 'uncertain';
  if (advanced.verdict === 'UNCERTAIN') return 'uncertain';
  return advanced.exact_verdict_match ? 'match' : 'mismatch';
}

export function baselineBadgeKind(baseline) {
  return baseline.correct_risk_classification ? 'match' : 'mismatch';
}
