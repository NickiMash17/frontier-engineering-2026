// Shared hand-coded SVG accuracy-bar pair (baseline vs. advanced).
// Consolidated here in the Final UI round -- previously dashboard.js and
// comparison.js each had their own copy of this exact markup, which would
// have meant applying the round's gradient/glow treatment twice and
// risking drift between them. Deliberately accent-vs-muted, not
// match/mismatch (see the .accuracy-bar-fill comment in styles.css for
// why an aggregate accuracy percentage doesn't borrow those three
// colors).
import { formatPercent } from '../lib/summary.js';

// idPrefix must be unique per rendered instance on the page -- the
// gradient <defs> ids it produces would otherwise collide silently
// across multiple bar pairs in the same document (e.g. Comparison's two
// tier columns, both present at once).
export function renderAccuracyBars(summary, idPrefix) {
  const baselinePct = summary.baseline.risk_classification_accuracy;
  const advancedPct = summary.advanced.risk_classification_accuracy;

  const bar = (pct, kind, label) => {
    const gradId = `${idPrefix}-bar-grad-${kind}`;
    const isAdvanced = kind === 'advanced';
    const colorVar = isAdvanced ? 'var(--color-accent)' : 'var(--color-text-secondary)';
    const darkStop = isAdvanced
      ? 'color-mix(in srgb, var(--color-accent) 65%, black)'
      : 'color-mix(in srgb, var(--color-text-secondary) 65%, black)';
    const width = pct === null ? 0 : Math.round(pct * 100);
    return `
      <div class="accuracy-bar-row">
        <span class="accuracy-bar-row__label">${label}</span>
        <svg class="accuracy-bar-track" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="${darkStop}" />
              <stop offset="1" stop-color="${colorVar}" />
            </linearGradient>
          </defs>
          <rect width="100" height="10" rx="5" style="fill: var(--color-border);" />
          <rect class="accuracy-bar-fill" width="${width}" height="10" rx="5"
                style="fill: url(#${gradId}); filter: drop-shadow(0 0 5px ${colorVar});" />
        </svg>
        <span class="accuracy-bar-row__value" data-countup="${pct === null ? 0 : pct}" data-countup-kind="percent">${formatPercent(pct)}</span>
      </div>
    `;
  };

  return `
    <div class="accuracy-bars">
      ${bar(baselinePct, 'baseline', 'Baseline')}
      ${bar(advancedPct, 'advanced', 'Advanced')}
    </div>
  `;
}
