// Minimal hash router -- no router library, per docs/FRONTEND_PLAN.md.
// Routes:
//   # or #/                     Screen 1 (Landing/Hero) -- true default now
//   #/dashboard/<tier>          Screen 3
//   #/replay/<tier>/<case_id>   Screen 2 (Pipeline Replay)
//   #/case/<tier>/<case_id>     Screen 4
//   #/compare                   Screen 6 (both tiers at once, no <tier> param)
// <tier> is 'tier-a' or 'tier-b'. Unknown hashes fall back to landing.
//
// The header (#app-header) is a separate container from the content
// region (#app-content) specifically so it never gets wiped/re-created
// on navigation -- it's updated in place, the content region fades. The
// header is hidden entirely on the landing screen, which is a
// full-viewport cold-open and deliberately owns the whole screen.

import { TIER_A } from './data/generated/tier-a.latest.js';
import { TIER_B } from './data/generated/tier-b.latest.js';
import { renderHeader } from './components/header.js';
import { renderLanding } from './components/landing.js';
import { renderDashboard } from './components/dashboard.js';
import { renderPipelineReplay } from './components/pipelineReplay.js';
import { renderCaseDetail } from './components/caseDetail.js';
import { renderComparison } from './components/comparison.js';

const DATA_BY_TIER = { 'tier-a': TIER_A, 'tier-b': TIER_B };
const header = document.getElementById('app-header');
const content = document.getElementById('app-content');

const FADE_MS = 140; // matches --transition-fast in styles.css

function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return { screen: 'landing' };
  if (parts[0] === 'dashboard' && parts[1]) return { screen: 'dashboard', tier: parts[1] };
  if (parts[0] === 'case' && parts[1] && parts[2]) {
    return { screen: 'case', tier: parts[1], caseId: decodeURIComponent(parts[2]) };
  }
  if (parts[0] === 'replay' && parts[1] && parts[2]) {
    return { screen: 'replay', tier: parts[1], caseId: decodeURIComponent(parts[2]) };
  }
  if (parts[0] === 'compare') return { screen: 'compare' };
  return { screen: 'landing' }; // unknown route -- fall back to landing, never a redirect loop
}

function renderScreen(route) {
  const tierData = route.tier ? DATA_BY_TIER[route.tier] || null : null;

  if (route.screen === 'landing') {
    renderLanding(content, { tierAData: DATA_BY_TIER['tier-a'], tierBData: DATA_BY_TIER['tier-b'] });
  } else if (route.screen === 'dashboard') {
    renderDashboard(content, { tier: route.tier, tierData });
  } else if (route.screen === 'replay') {
    renderPipelineReplay(content, { tier: route.tier, tierData, caseId: route.caseId });
  } else if (route.screen === 'case') {
    renderCaseDetail(content, { tier: route.tier, tierData, caseId: route.caseId });
  } else if (route.screen === 'compare') {
    renderComparison(content, { tierAData: DATA_BY_TIER['tier-a'], tierBData: DATA_BY_TIER['tier-b'] });
  }
}

let isFirstRender = true;
let currentRoute = null;

// Centralized (not per-component) so there is exactly one listener ever
// registered, checking whatever route is current at the time of the
// keypress -- avoids the alternative of each screen adding its own
// listener and having to remember to remove it on navigation.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && currentRoute && currentRoute.screen === 'case') {
    window.location.hash = `/dashboard/${currentRoute.tier}`;
  }
});

function render() {
  const route = parseRoute(window.location.hash);
  currentRoute = route;

  if (route.screen === 'landing') {
    header.hidden = true;
  } else {
    header.hidden = false;
    renderHeader(header, {
      activeTier: route.screen === 'dashboard' ? route.tier : null,
      tierAData: DATA_BY_TIER['tier-a'],
      tierBData: DATA_BY_TIER['tier-b'],
    });
  }

  if (isFirstRender) {
    // No fade on the very first paint -- there's nothing to transition
    // from, and it would just delay the initial render.
    isFirstRender = false;
    renderScreen(route);
    return;
  }

  content.classList.add('is-transitioning');
  setTimeout(() => {
    renderScreen(route);
    requestAnimationFrame(() => content.classList.remove('is-transitioning'));
  }, FADE_MS);
}

window.addEventListener('hashchange', render);
render();
