// Shared, low-opacity ambient network-line texture reused behind Screens
// 3/5/6 (Results Dashboard, Evidence Panel, Comparison) -- Final UI round,
// so these interior screens read as the same product as the landing
// hero instead of a disconnected set of data tables bolted onto one
// animated cold-open. Same abstract, non-data-bound technique as
// landing.js's heroTraceBackground (arbitrary hand-placed positions, no
// tooltip, no real case's path), but much fainter and with no pulsing
// "danger" node -- this is quiet texture behind dense data, not a second
// hero moment. Kept in one shared module so every call site renders
// byte-identical markup instead of drifting copies.
export function renderAmbientBg() {
  const nodes = [
    [40, 30], [180, 90], [320, 40], [460, 110], [560, 60],
    [120, 150], [380, 160], [520, 150], [260, 20],
  ];
  const edges = [
    [0, 1], [1, 2], [1, 5], [2, 3], [3, 4], [3, 6], [4, 7], [5, 6], [6, 7], [2, 8],
  ];

  const lines = edges
    .map(([a, b]) => `<line x1="${nodes[a][0]}" y1="${nodes[a][1]}" x2="${nodes[b][0]}" y2="${nodes[b][1]}" class="ambient-bg__line" />`)
    .join('');
  const dots = nodes
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" class="ambient-bg__node" />`)
    .join('');

  return `
    <svg class="ambient-bg" viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g class="ambient-bg__group">${lines}${dots}</g>
    </svg>
  `;
}
