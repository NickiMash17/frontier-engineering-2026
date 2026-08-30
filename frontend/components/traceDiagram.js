// Signature visual: a hand-coded SVG "circuit trace" diagram of a case's
// real advanced.full_output.reachable_path -- one node per path entry,
// connected by lines that draw themselves in (stroke-dasharray/
// stroke-dashoffset, the classic technique -- no animation library).
// Reused, unmodified, by both Screen 4 (drawn all at once on mount, with
// a per-segment stagger so it still reads as "lighting up in sequence")
// and Screen 2 (drawn one real step at a time, paced by the replay).
//
// Only rendered when reachable_path is non-empty -- an empty path has
// nothing to trace and is each screen's job to handle separately (a
// plain "no path" state), not this module's.

import { escapeHtml } from '../lib/format.js';
import { isRisk } from '../lib/summary.js';

const NODE_R = 9;
const COL_W = 132;
const ROW_H = 64;
const PAD = 24;
const MAX_COLS = 4;

// Single source of truth for the wrapper class name a caller should put
// on the element it renders/inserts this diagram's markup into.
// `bare: true` drops the card styling (border/shadow/background/padding)
// for when the diagram is already sitting on a card's own surface (Screen
// 2's replay stage) -- `bare: false` (default) keeps it for when the
// diagram is not nested inside anything else (Screen 4). One rule, not
// two divergent hardcoded class strings per caller.
export function traceDiagramWrapClass(bare = false) {
  return bare ? 'trace-diagram-wrap trace-diagram-wrap--bare' : 'trace-diagram-wrap';
}
const STUB_FRACTION = 0.4; // how far the "doesn't connect" stub reaches toward the placeholder

// Snake layout: left-to-right on even rows, right-to-left on odd rows,
// so consecutive nodes are always adjacent (no long jump back to the
// left edge when wrapping) -- reads as one continuous trace.
function computeLayout(nodeCount) {
  const cols = Math.min(nodeCount, MAX_COLS);
  const rows = Math.ceil(nodeCount / cols);
  const positions = [];
  for (let i = 0; i < nodeCount; i += 1) {
    const row = Math.floor(i / cols);
    const posInRow = i % cols;
    const col = row % 2 === 0 ? posInRow : cols - 1 - posInRow;
    positions.push({ x: PAD + col * COL_W, y: PAD + row * ROW_H });
  }
  return {
    positions,
    width: PAD * 2 + (Math.min(cols, nodeCount) - 1) * COL_W,
    height: PAD * 2 + (rows - 1) * ROW_H,
  };
}

function segmentLength(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Real reachable_path arrays come in two shapes from the same schema
// field: Tier B's agent-produced ones are already one hop per array
// entry, but Tier A's were hand-authored on Day 1 as a single string
// with the whole multi-hop story joined by " -> " (found via live
// testing on case-a-reachable-minimist: 1 array entry, 4 embedded
// arrows, meant to be 5 real hops -- rendered as one disconnected node
// before this fix). Some Tier B entries also embed an extra arrow inside
// an otherwise-separate entry (e.g. tb-3's "Any client GET /memos ->
// ... -> ..." hop), so this can't be a per-case format switch -- every
// entry, from either shape, gets split on whichever arrow it actually
// contains (both "->" and the Unicode "→" are checked; only "->" has
// been observed in the real data so far, but both are handled without
// needing to know in advance which one a given case uses). An entry
// with no arrow at all splits into exactly itself, so already-one-hop-
// per-entry data (most of Tier B) is completely unaffected.
export function flattenReachablePath(rawSteps) {
  return rawSteps
    .flatMap((entry) => String(entry).split(/\s*(?:->|→)\s*/))
    .map((hop) => hop.trim())
    .filter(Boolean);
}

// `steps` is the real reachable_path array (already non-empty -- callers
// check; may be either shape described above, flattened here before use
// so every downstream computation -- node count, layout, segment count
// -- is based on real per-hop entries). `verdict` decides the final
// node's treatment: REACHABLE gets a glowing "hot" sink in --accent-risk.
// Anything else adds one extra placeholder sink node in --text-secondary,
// and the segment reaching for it is a short, static, dashed stub (not
// an animated draw-in) -- visualizing "traced this far, nothing
// confirmed connects," not a completed connection sped up.
export function renderTraceDiagram({ steps: rawSteps, verdict }) {
  const steps = flattenReachablePath(rawSteps);
  const reachable = isRisk(verdict);
  const lastRealIndex = steps.length - 1;
  const nodeCount = reachable ? steps.length : steps.length + 1;
  const { positions, width, height } = computeLayout(nodeCount);

  const realSegments = [];
  for (let i = 0; i < steps.length - 1; i += 1) {
    const a = positions[i];
    const b = positions[i + 1];
    const len = segmentLength(a, b);
    realSegments.push(`
      <line data-trace-segment data-index="${i}" class="trace-segment"
        x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
        style="stroke-dasharray: ${len}; stroke-dashoffset: ${len};" />
    `);
  }

  const nodes = steps
    .map((step, i) => {
      const p = positions[i];
      const isSink = reachable && i === lastRealIndex;
      const isLastReal = i === lastRealIndex;
      return `
        <g data-trace-node data-index="${i}" ${isLastReal ? 'data-is-last-real="true"' : ''}
           class="trace-node${isSink ? ' trace-node--sink' : ''}" transform="translate(${p.x}, ${p.y})">
          <title>${escapeHtml(step)}</title>
          ${isSink ? '<circle class="trace-node__glow" r="16" />' : ''}
          <circle class="trace-node__dot" r="${NODE_R}" />
          <text class="trace-node__label" x="0" y="4" text-anchor="middle">${i + 1}</text>
        </g>
      `;
    })
    .join('');

  let stub = '';
  let placeholder = '';
  if (!reachable) {
    const a = positions[lastRealIndex];
    const b = positions[steps.length];
    const len = segmentLength(a, b);
    const stubLen = len * STUB_FRACTION;
    // Static, not animated: a short dash starting at the last real node,
    // then a gap covering the rest of the distance -- always visible at
    // this partial length once faded in, never transitions to "complete."
    stub = `
      <line data-trace-stub class="trace-segment trace-segment--stub"
        x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"
        style="stroke-dasharray: ${stubLen} ${len};" />
    `;
    placeholder = `
      <g data-trace-placeholder class="trace-node trace-node--placeholder" transform="translate(${b.x}, ${b.y})">
        <title>No confirmed sink -- the trace does not connect</title>
        <circle class="trace-node__dot trace-node__dot--placeholder" r="${NODE_R}" stroke-dasharray="3,3" />
      </g>
    `;
  }

  return `
    <svg class="trace-diagram" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img"
      aria-label="Call-path trace, ${steps.length} step(s), ${reachable ? 'reaching a confirmed sink' : 'not reaching a confirmed sink'}">
      ${realSegments.join('')}
      ${stub}
      ${nodes}
      ${placeholder}
    </svg>
  `;
}

// Reveals node/segment `index` (0-based, matching `steps[index]`) by
// adding the classes that trigger their CSS transitions -- the
// connecting line draws in (stroke-dashoffset -> 0) and the node fades
// in. When `index` is the last real step and the case doesn't reach a
// confirmed sink, the stub + placeholder fade in at the same moment --
// that IS the reveal of "this is where it stops." Safe to call
// repeatedly; revealing an already-revealed index is a no-op.
export function revealTraceStep(container, index) {
  const node = container.querySelector(`[data-trace-node][data-index="${index}"]`);
  const segment = container.querySelector(`[data-trace-segment][data-index="${index - 1}"]`);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (segment) segment.classList.add('trace-segment--drawn');
      if (node) {
        node.classList.add('trace-node--revealed');
        if (node.dataset.isLastReal === 'true') {
          const stub = container.querySelector('[data-trace-stub]');
          const placeholder = container.querySelector('[data-trace-placeholder]');
          if (stub) stub.classList.add('trace-segment--visible');
          if (placeholder) placeholder.classList.add('trace-node--revealed');
        }
      }
    });
  });
}

// Auto-plays every step with a fixed stagger -- used where the diagram
// isn't paced by anything external (Screen 4's on-mount reveal).
export function revealAllTraceSteps(container, stepCount, staggerMs = 110) {
  for (let i = 0; i < stepCount; i += 1) {
    setTimeout(() => revealTraceStep(container, i), i * staggerMs);
  }
}
