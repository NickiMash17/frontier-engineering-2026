// Screen 1 -- Landing / Hero (docs/FRONTEND_PLAN.md Section 3, Screen 1).
// The cold-open. Full-viewport hero, then the two real recorded runs as
// selectable cards. Not a live scanner -- this project has no live
// backend -- so every card is explicit that it replays a real,
// previously-recorded evaluation run, per the honesty framing already
// decided in FRONTEND_PLAN.md and never silently dropped.

import { getSummary, formatPercent } from '../lib/summary.js';
import { escapeHtml } from '../lib/format.js';
import { animateBarFills, animateCountUps } from '../lib/animate.js';

const TIER_LABELS = { 'tier-a': 'Tier A', 'tier-b': 'Tier B' };

const COUNT_UP_FORMATTERS = { percent: formatPercent };

function heroStat(tierAData, tierBData) {
  const [label, data] = tierBData ? ['Tier B', tierBData] : tierAData ? ['Tier A', tierAData] : [null, null];
  if (!data) return '<p class="hero__stat-fallback">No recorded run loaded yet.</p>';
  const summary = getSummary(data);
  const baseline = summary.baseline.risk_classification_accuracy;
  const advanced = summary.advanced.risk_classification_accuracy;
  return `
    <div class="hero__stat">
      <span class="hero__stat-value" data-countup="${baseline === null ? 0 : baseline}" data-countup-kind="percent">${formatPercent(baseline)}</span>
      <span class="hero__stat-arrow">→</span>
      <span class="hero__stat-value hero__stat-value--advanced" data-countup="${advanced === null ? 0 : advanced}" data-countup-kind="percent">${formatPercent(advanced)}</span>
      <span class="hero__stat-label">${escapeHtml(label)} accuracy, baseline vs. advanced (n=${summary.total_cases}, real run)</span>
    </div>
  `;
}

function tierCard(tierKey, data) {
  const label = TIER_LABELS[tierKey];
  if (!data) {
    return `
      <div class="card run-card">
        <div class="run-card__label">${escapeHtml(label)}</div>
        <p class="detail-meta">No data loaded. Run <code>node scripts/frontend/generate_data.js</code>.</p>
      </div>
    `;
  }
  const summary = getSummary(data);
  return `
    <a href="#/dashboard/${tierKey}" class="card run-card run-card--link">
      <div class="run-card__label">${escapeHtml(label)}</div>
      <div class="run-card__meta">${summary.total_cases} case(s) &middot; real evaluation run</div>
      <div class="run-card__accuracy">
        <span class="mono">${formatPercent(summary.baseline.risk_classification_accuracy)}</span>
        <span class="summary-card__arrow">→</span>
        <span class="mono run-card__accuracy--advanced">${formatPercent(summary.advanced.risk_classification_accuracy)}</span>
      </div>
      <div class="run-card__cta">Replay this run →</div>
    </a>
  `;
}

// Ambient background art for the hero -- a large, slow-drifting, very
// low-opacity version of the product's own trace-diagram motif (nodes +
// draw-in-style lines). Deliberately abstract and NOT tied to any real
// case's data (no tooltips, no real path text, arbitrary hand-placed
// positions) -- it's texture that gestures at "this product traces
// connections," not a diagram making a claim.
function heroTraceBackground() {
  const nodes = [
    [80, 120], [260, 300], [420, 90], [560, 340], [700, 180],
    [860, 420], [950, 140], [180, 480], [620, 520],
  ];
  const edges = [
    [0, 1], [1, 2], [1, 3], [3, 4], [4, 6], [3, 5], [5, 8], [0, 7], [7, 8],
  ];
  const glowNodes = [5, 6]; // ordered, not a Set -- index within this list drives the stagger below

  const lines = edges
    .map(([a, b]) => `<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" class="hero-trace-bg__line" />`)
    .join('');
  const dots = nodes
    .map(([x, y], i) => {
      const glowIndex = glowNodes.indexOf(i);
      const isGlow = glowIndex !== -1;
      // Inline delay, not an nth-of-type CSS selector -- nth-of-type
      // counts ALL sibling <circle>s regardless of class, which would
      // pick the wrong nodes here since glow and non-glow dots share a
      // tag name.
      const delayAttr = isGlow ? ` style="animation-delay: ${glowIndex * 1.4}s;"` : '';
      return `<circle cx="${x}" cy="${y}" r="${isGlow ? 7 : 4.5}" class="hero-trace-bg__node${isGlow ? ' hero-trace-bg__node--glow' : ''}"${delayAttr} />`;
    })
    .join('');

  return `
    <svg class="hero-trace-bg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g class="hero-trace-bg__group">
        ${lines}
        ${dots}
      </g>
    </svg>
  `;
}

export function renderLanding(container, { tierAData, tierBData }) {
  container.innerHTML = `
    <div class="hero">
      <div class="hero__bg" aria-hidden="true">${heroTraceBackground()}</div>
      <div class="hero__content">
        <p class="hero__eyebrow">Frontier Engineering Challenge 2026</p>
        <h1 class="hero__title">CVE Reachability</h1>
        <p class="hero__tagline">Dependency scanners flag presence. We prove reachability.</p>
        ${heroStat(tierAData, tierBData)}
        <a href="#/dashboard/tier-b" class="hero__cta">Explore the results ↓</a>
      </div>
    </div>
    <div class="screen">
      <p class="landing-section-label">Replay a real, previously-recorded evaluation run</p>
      <div class="run-card-grid">
        ${tierCard('tier-a', tierAData)}
        ${tierCard('tier-b', tierBData)}
      </div>
    </div>
  `;
  animateBarFills(container);
  animateCountUps(container, COUNT_UP_FORMATTERS);
}
