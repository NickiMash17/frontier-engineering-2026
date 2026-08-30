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

// Hand-drawn (not an icon font/library), restrained empty-state
// illustration for the "no data loaded" and "case not found" paths --
// both are real, reachable states (missing generated data files, a bad
// hash in the URL), not decorative. Shown so hitting one of them looks
// intentional rather than broken.
export function emptyStateIllustration() {
  return `
    <svg class="empty-state-illustration" width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="20" style="stroke: var(--color-border-strong);" stroke-width="2" />
      <line x1="46" y1="46" x2="60" y2="60" style="stroke: var(--color-border-strong);" stroke-width="2" stroke-linecap="round" />
      <path d="M24 32h16" style="stroke: var(--color-text-secondary);" stroke-width="2" stroke-linecap="round" />
    </svg>
  `;
}

// Small hand-drawn verdict icons (checkmark / cross / question mark) for
// the case-detail verdict badges -- not an icon font. Kind matches
// advancedBadgeKind/baselineBadgeKind's return values.
export function verdictIcon(kind) {
  if (kind === 'match') {
    return `<svg class="verdict-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 7.5l2.5 2.5L11 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
  }
  if (kind === 'mismatch') {
    return `<svg class="verdict-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>`;
  }
  return `<svg class="verdict-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M4.5 5.2c0-1.4 1.1-2.5 2.5-2.5s2.5 1 2.5 2.2c0 1.3-1.2 1.7-2 2.3-.5.4-.5.8-.5 1.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /><circle cx="7" cy="10.8" r="0.9" fill="currentColor" /></svg>`;
}

// Same badge as `badge()`, but larger and with a hand-drawn icon --
// reserved for the case-detail verdict row, the one place a verdict is
// the hero of the screen.
export function verdictBadgeLarge(kind, label) {
  const kindClass = { match: 'badge--match', mismatch: 'badge--mismatch', uncertain: 'badge--uncertain' }[kind] || '';
  return `<span class="badge badge--large ${kindClass}">${verdictIcon(kind)}${escapeHtml(label)}</span>`;
}
