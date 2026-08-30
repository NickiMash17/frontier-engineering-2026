// Screen 2 -- Pipeline Replay (docs/FRONTEND_PLAN.md Section 3, Screen 2).
// A staged reveal of one case's real recorded investigation: Baseline
// Scan -> Advanced Investigation, paced by that case's real
// advanced.duration_ms (scaled down for watchability, proportionally --
// not a fixed animation speed regardless of the real number). Ends by
// linking into the full case detail (Screen 4).
//
// Round 3: the advanced stage now builds the same call-path trace
// diagram used on Screen 4 (components/traceDiagram.js), one real step
// at a time, instead of a plain evidence-badge list -- the trace
// reaching the glowing sink (REACHABLE) or stopping at the stub
// (anything else) IS the climax, not a badge popping in afterward.
//
// Every fact shown (verdict, path steps, confidence, duration) is the
// real recorded value -- only the reveal *pacing* is stylized.

import { escapeHtml, badge, advancedBadgeKind, baselineBadgeKind } from '../lib/format.js';
import { formatPercent } from '../lib/summary.js';
import { renderTraceDiagram, revealTraceStep, traceDiagramWrapClass, flattenReachablePath } from './traceDiagram.js';

const TIER_LABELS = { 'tier-a': 'Tier A', 'tier-b': 'Tier B' };

const BASELINE_STAGE_MS = 500; // fixed UI pacing -- baseline has no real timing data to scale from
const SCALE_DIVISOR = 12; // deliberate UX choice, not derived from data -- see file header
const MIN_ADVANCED_MS = 1200;
const MAX_ADVANCED_MS = 5000;

function scaledAdvancedDuration(realMs) {
  if (!realMs) return MIN_ADVANCED_MS;
  return Math.max(MIN_ADVANCED_MS, Math.min(MAX_ADVANCED_MS, realMs / SCALE_DIVISOR));
}

// Runs an ordered list of {delay, reveal} steps. skip() clears any
// pending timers and runs every remaining reveal synchronously, in
// order, so nothing is ever skipped *out* of order -- only sped up.
function runSequence(steps) {
  let i = 0;
  let skipped = false;
  const timers = [];

  function next() {
    if (i >= steps.length) return;
    const step = steps[i];
    if (skipped) {
      step.reveal();
      i += 1;
      next();
      return;
    }
    timers.push(
      setTimeout(() => {
        step.reveal();
        i += 1;
        next();
      }, step.delay)
    );
  }
  next();

  return {
    skip() {
      if (skipped) return;
      skipped = true;
      timers.forEach(clearTimeout);
      while (i < steps.length) {
        steps[i].reveal();
        i += 1;
      }
    },
  };
}

function skeleton(tier, result) {
  return `
    <div class="screen replay-screen">
      <a href="#/dashboard/${tier}" class="back-link">← Back to ${escapeHtml(TIER_LABELS[tier])} dashboard</a>
      <div class="replay-toolbar">
        <h1 class="screen-title replay-screen-title mono">${escapeHtml(result.cve)}</h1>
        <button type="button" class="replay-skip-btn">Skip ⏭</button>
      </div>

      <section class="replay-stage" data-stage="baseline">
        <div class="replay-stage__header">
          <span class="replay-stage__dot"></span>
          <span>Baseline Scan</span>
        </div>
        <div class="replay-stage__body" data-slot="baseline-body">
          <p class="detail-meta">Checking installed version against advisory database…</p>
        </div>
      </section>

      <section class="replay-stage" data-stage="advanced">
        <div class="replay-stage__header">
          <span class="replay-stage__dot"></span>
          <span>Advanced Investigation (single agent)</span>
        </div>
        <div class="replay-stage__body" data-slot="advanced-body">
          <p class="detail-meta" data-slot="advanced-caption">Waiting for baseline…</p>
          <div class="${traceDiagramWrapClass(true)}" data-slot="advanced-trace" hidden></div>
        </div>
      </section>

      <div class="replay-end" data-slot="end" hidden>
        <a href="#/case/${tier}/${encodeURIComponent(result.case_id)}" class="hero__cta">View full case detail →</a>
      </div>
    </div>
  `;
}

export function renderPipelineReplay(container, { tier, tierData, caseId }) {
  if (!tierData) {
    container.innerHTML = `<div class="screen"><div class="card notice"><p>No data loaded for ${escapeHtml(TIER_LABELS[tier])}.</p></div></div>`;
    return;
  }
  const result = tierData.results.find((r) => r.case_id === caseId);
  if (!result) {
    container.innerHTML = `
      <div class="screen">
        <a href="#/dashboard/${tier}" class="back-link">← Back to ${escapeHtml(TIER_LABELS[tier])} dashboard</a>
        <div class="card notice"><p>No case named <span class="mono">${escapeHtml(caseId)}</span> in ${escapeHtml(TIER_LABELS[tier])}.</p></div>
      </div>
    `;
    return;
  }

  container.innerHTML = skeleton(tier, result);

  const stageEls = { baseline: container.querySelector('[data-stage="baseline"]'), advanced: container.querySelector('[data-stage="advanced"]') };
  const baselineBody = container.querySelector('[data-slot="baseline-body"]');
  const caption = container.querySelector('[data-slot="advanced-caption"]');
  const traceWrap = container.querySelector('[data-slot="advanced-trace"]');
  const endSlot = container.querySelector('[data-slot="end"]');

  stageEls.baseline.classList.add('replay-stage--active');

  const steps = [];

  // -- Baseline stage: one reveal step --
  steps.push({
    delay: BASELINE_STAGE_MS,
    reveal() {
      baselineBody.innerHTML = `
        <p>Installed version matches a known-vulnerable range.</p>
        <p>${badge(baselineBadgeKind(result.baseline), result.baseline.verdict)}</p>
      `;
      stageEls.baseline.classList.remove('replay-stage--active');
      stageEls.baseline.classList.add('replay-stage--done');
      stageEls.advanced.classList.add('replay-stage--active');
    },
  });

  const advanced = result.advanced;

  function finish() {
    stageEls.advanced.classList.remove('replay-stage--active');
    stageEls.advanced.classList.add('replay-stage--done');
    endSlot.hidden = false;
  }

  if (!advanced.ok) {
    // Distinct failure state -- never presented as a real UNCERTAIN
    // verdict, same rule as Screen 4 (docs/FRONTEND_PLAN.md).
    steps.push({
      delay: scaledAdvancedDuration(advanced.duration_ms),
      reveal() {
        caption.textContent = 'Investigation could not complete.';
        traceWrap.hidden = true;
        traceWrap.insertAdjacentHTML(
          'afterend',
          `<div class="card notice notice--failed"><div class="notice__title">Investigation failed</div><p class="mono">${escapeHtml(advanced.error || 'unknown error')}</p></div>`
        );
        finish();
      },
    });
  } else {
    const rawReachablePath = Array.isArray(advanced.full_output?.reachable_path) ? advanced.full_output.reachable_path : [];
    // Flattened once here so the reveal loop's step count/indices match
    // exactly what renderTraceDiagram will actually render as nodes --
    // see traceDiagram.js's flattenReachablePath for why raw array length
    // and real hop count can differ (Tier A's single-string-with-arrows
    // format vs. Tier B's already-one-hop-per-entry format).
    const reachablePath = flattenReachablePath(rawReachablePath);

    if (reachablePath.length === 0) {
      // Nothing to trace -- a real state (e.g. a pure dead import or
      // pure transitive dependency), not a diagram to force.
      steps.push({
        delay: scaledAdvancedDuration(advanced.duration_ms),
        reveal() {
          caption.textContent = 'No reachable path found -- the flagged package is never invoked by application code.';
          caption.insertAdjacentHTML(
            'afterend',
            `<p>${badge(advancedBadgeKind(advanced), advanced.verdict)} <span class="detail-meta">confidence ${advanced.confidence != null ? advanced.confidence.toFixed(2) : 'n/a'}</span></p>`
          );
          finish();
        },
      });
    } else {
      const perStepMs = scaledAdvancedDuration(advanced.duration_ms) / (reachablePath.length + 1);

      steps.push({
        delay: perStepMs,
        reveal() {
          caption.textContent = 'Glob: scanning repository, tracing call path…';
          traceWrap.hidden = false;
          traceWrap.innerHTML = renderTraceDiagram({ steps: reachablePath, verdict: advanced.verdict });
        },
      });

      reachablePath.forEach((step, i) => {
        steps.push({
          delay: perStepMs,
          reveal() {
            caption.textContent = `Step ${i + 1}/${reachablePath.length}: ${step}`;
            revealTraceStep(traceWrap, i);
            if (i === reachablePath.length - 1) {
              const verdictNote = document.createElement('p');
              verdictNote.className = 'replay-trace-verdict-note';
              verdictNote.innerHTML = `${badge(advancedBadgeKind(advanced), advanced.verdict)} <span class="detail-meta">confidence ${advanced.confidence != null ? advanced.confidence.toFixed(2) : 'n/a'} · evidence completeness ${formatPercent(advanced.evidence_completeness)}</span>`;
              traceWrap.insertAdjacentElement('afterend', verdictNote);
              finish();
            }
          },
        });
      });
    }
  }

  const sequence = runSequence(steps);
  container.querySelector('.replay-skip-btn').addEventListener('click', () => sequence.skip());
}
