// Persistent app header, rendered once into its own container (#app-header
// in index.html) and updated on every route change -- but never wiped by
// a screen's own innerHTML swap, so it doesn't flicker between screens.
// Owns the tier tabs and the compare link (moved out of dashboard.js,
// which no longer renders its own nav) plus a real headline stat, plus
// the explicit light/dark theme toggle.

import { getSummary, formatPercent } from '../lib/summary.js';
import { escapeHtml } from '../lib/format.js';

const TIER_LABELS = { 'tier-a': 'Tier A', 'tier-b': 'Tier B' };

// The headline stat prefers Tier B (the real-world benchmark) since it's
// the more meaningful claim; falls back to Tier A if Tier B has no data
// loaded, and renders nothing rather than a fabricated number if neither
// does.
function headlineStat(tierAData, tierBData) {
  const [label, data] = tierBData ? ['Tier B', tierBData] : tierAData ? ['Tier A', tierAData] : [null, null];
  if (!data) return '';
  const summary = getSummary(data);
  const pct = formatPercent(summary.advanced.risk_classification_accuracy);
  const n = summary.advanced.cases_completed_ok;
  const total = summary.total_cases;
  return `<span class="app-header__stat">${escapeHtml(label)} advanced accuracy: <strong>${pct}</strong> (${n}/${total})</span>`;
}

// Both icons are always present; styles.css shows/hides them purely via
// the data-theme attribute on <html>, so the click handler below never
// has to touch the button's markup -- only the attribute + localStorage.
function themeToggleButton() {
  return `
    <button type="button" class="theme-toggle" aria-label="Switch between light and dark theme">
      <svg class="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3.2" fill="currentColor" />
        <g stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
          <line x1="8" y1="0.5" x2="8" y2="2.2" />
          <line x1="8" y1="13.8" x2="8" y2="15.5" />
          <line x1="0.5" y1="8" x2="2.2" y2="8" />
          <line x1="13.8" y1="8" x2="15.5" y2="8" />
          <line x1="2.5" y1="2.5" x2="3.7" y2="3.7" />
          <line x1="12.3" y1="12.3" x2="13.5" y2="13.5" />
          <line x1="2.5" y1="13.5" x2="3.7" y2="12.3" />
          <line x1="12.3" y1="3.7" x2="13.5" y2="2.5" />
        </g>
      </svg>
      <svg class="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
        <path d="M13 8.5A5.5 5.5 0 1 1 7.5 3a4.2 4.2 0 0 0 5.5 5.5z" fill="currentColor" />
      </svg>
    </button>
  `;
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function attachThemeToggle(container) {
  const button = container.querySelector('.theme-toggle');
  if (!button) return;
  button.addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      // Private browsing / storage disabled -- the toggle still works
      // for this page view, it just won't persist across reloads.
    }
  });
}

export function renderHeader(container, { activeTier, tierAData, tierBData }) {
  container.innerHTML = `
    <div class="app-header__inner">
      <a href="#/" class="app-header__brand" aria-label="CVE Reachability -- back to landing page"><span class="app-header__brand-mark">●</span> CVE Reachability</a>
      <nav class="tier-tabs">
        ${Object.entries(TIER_LABELS)
          .map(
            ([key, label]) =>
              `<a href="#/dashboard/${key}" class="tier-tab${key === activeTier ? ' tier-tab--active' : ''}">${label}</a>`
          )
          .join('')}
        <a href="#/compare" class="tier-tab tier-tab--compare">Compare →</a>
      </nav>
      ${headlineStat(tierAData, tierBData)}
      ${themeToggleButton()}
    </div>
  `;
  attachThemeToggle(container);
}
