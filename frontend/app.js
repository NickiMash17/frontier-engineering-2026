// Scaffold-verification stub, NOT a screen implementation. Its only job
// is to prove the shell actually works end to end: ES module imports
// resolve (i.e. the page is being served, not opened via file://) and the
// generated real data loads. The six real screens (docs/FRONTEND_PLAN.md
// Section 3) replace this file's body in the next phase.

import { TIER_A } from './data/generated/tier-a.latest.js';
import { TIER_B } from './data/generated/tier-b.latest.js';

const app = document.getElementById('app');

function summarize(label, data) {
  if (!data || !Array.isArray(data.results)) {
    return `${label}: no data loaded`;
  }
  return `${label}: ${data.results.length} case(s) loaded`;
}

app.dataset.state = 'ready';
app.innerHTML = `
  <div style="padding: var(--space-4); font-family: var(--font-sans);">
    <h1 style="font-size: var(--fs-xl); margin-bottom: var(--space-2);">Frontend shell OK</h1>
    <p class="mono">${summarize('Tier A', TIER_A)}</p>
    <p class="mono">${summarize('Tier B', TIER_B)}</p>
    <p style="margin-top: var(--space-4); color: var(--color-text-secondary);">
      Screens not yet implemented -- see docs/FRONTEND_PLAN.md Section 3.
    </p>
  </div>
`;
