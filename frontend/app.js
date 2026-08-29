// Minimal hash router -- no router library, per docs/FRONTEND_PLAN.md.
// Routes:
//   #/dashboard/<tier>          Screen 3
//   #/case/<tier>/<case_id>     Screen 4
// <tier> is 'tier-a' or 'tier-b'. Unknown/empty hashes redirect to
// whichever tier actually has data loaded (see defaultTier()).

import { TIER_A } from './data/generated/tier-a.latest.js';
import { TIER_B } from './data/generated/tier-b.latest.js';
import { renderDashboard } from './components/dashboard.js';
import { renderCaseDetail } from './components/caseDetail.js';

const DATA_BY_TIER = { 'tier-a': TIER_A, 'tier-b': TIER_B };
const app = document.getElementById('app');

function defaultTier() {
  if (DATA_BY_TIER['tier-b']) return 'tier-b';
  if (DATA_BY_TIER['tier-a']) return 'tier-a';
  return 'tier-b'; // neither loaded -- dashboard renders its own "no data" notice
}

function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'dashboard' && parts[1]) {
    return { screen: 'dashboard', tier: parts[1] };
  }
  if (parts[0] === 'case' && parts[1] && parts[2]) {
    return { screen: 'case', tier: parts[1], caseId: decodeURIComponent(parts[2]) };
  }
  return null;
}

function render() {
  const route = parseRoute(window.location.hash);

  if (!route) {
    window.location.hash = `/dashboard/${defaultTier()}`;
    return; // hashchange will re-fire render()
  }

  const tierData = DATA_BY_TIER[route.tier] || null;

  if (route.screen === 'dashboard') {
    renderDashboard(app, { tier: route.tier, tierData });
  } else if (route.screen === 'case') {
    renderCaseDetail(app, { tier: route.tier, tierData, caseId: route.caseId });
  }
}

window.addEventListener('hashchange', render);
render();
