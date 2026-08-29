'use strict';

// Minimal numeric x.y.z version comparison. Deliberately not a dependency
// on `semver` -- the only ranges this project needs are plain "introduced
// 0, fixed at X.Y.Z" ranges from OSV.dev records, which a ~15-line
// comparator handles correctly without pulling in a package for it.

function parse(version) {
  const [core] = String(version).split('-'); // drop any pre-release suffix
  return core.split('.').map((n) => parseInt(n, 10) || 0);
}

// Returns -1, 0, or 1 like a standard comparator.
function compare(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

function lessThan(a, b) {
  return compare(a, b) < 0;
}

module.exports = { compare, lessThan };
