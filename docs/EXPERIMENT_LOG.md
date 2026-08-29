# Experiment Log

Every meaningful experiment run during implementation, in order. Numbers
here are taken directly from real run output (agent transcripts / CLI JSON
results, checked into `evaluation/results/`) -- nothing is estimated or
back-filled.

---

## Experiment 1 — Ground-truth calibration failure on minimist@1.2.5

**Hypothesis:** minimist@1.2.5, pinned per GHSA-xvch-5gv4-984h /
CVE-2021-44906 ("fixed in 1.2.6"), is a genuinely exploitable prototype-
pollution target and can serve as the "REACHABLE" Tier A case.

**Input:** Real `npm install minimist@1.2.5` into `fixtures/case-a-*`;
smoke-test invocation of the advanced agent against it.

**System version:** First draft of Tier A fixtures, pre-evaluation-harness.

**Result:** The agent returned `CONDITION_NOT_SATISFIED` with 0.85
confidence, citing the exact installed `node_modules/minimist/index.js`
source and the package's own bundled `test/proto.js`, both showing the
shipped 1.2.5 code already guards against the `__proto__` and
`constructor.prototype` payload shapes.

**Independent verification (not trusting the agent's claim on its own):**
```js
const minimist = require('minimist'); // real npm-installed 1.2.5
minimist(['--constructor.prototype.polluted', 'yes']);
minimist(['--__proto__.polluted2', 'yes']);
// ({}).polluted === undefined, ({}).polluted2 === undefined
```
Confirmed against the actual npm registry tarball (shasum verified via
`registry.npmjs.org/minimist/1.2.5`), and independently against a diff of
the real 1.2.5 vs. 1.2.6 tarballs -- the diff shows 1.2.6 only *adds* a
narrower `isConstructorOrProto()` check on top of guards already present
in 1.2.5, it does not introduce the base `__proto__`/`Object.prototype`
guards themselves.

**Failure/success:** Failure -- of the fixture's ground truth, not of the
agent. The advisory's "fixed: 1.2.6" framing does not mean "1.2.5 is
exploitable by the standard payload"; the agent was right to defer to
`CONDITION_NOT_SATISFIED` rather than trust the advisory metadata blindly,
and right to flag the version discrepancy as an explicit uncertainty
instead of asserting either way with false confidence.

**Decision:** Replaced the CVE/version pinned in the reachable Tier A
cases. Found and empirically verified a genuinely exploitable version by
direct experiment (not by trusting any advisory's stated range in
isolation):
```js
// real npm-installed minimist@1.2.0
minimist(['--__proto__.y', 'Polluted']);
// ({}).y === 'Polluted'  <-- genuinely polluted
```
Switched to **CVE-2020-7598 (GHSA-vh95-rmgr-6w4m)**, `minimist@1.2.0`,
across `case-a`, `case-b`, and `case-d`. Also empirically verified
`lodash@4.17.11` / CVE-2019-10744 is genuinely exploitable via
`_.defaultsDeep({}, {constructor:{prototype:{polluted:'yes'}}}, {})` --
that CVE/version pairing was correct from the start and needed no change.

**Next action:** Rebuild `data/advisories/index.json` and all affected
`ground_truth.json` files against the verified facts (done); re-run the
full evaluation (Experiment 3).

**Process note:** This is the single most important thing that happened
on Day 1. It is a direct, first-hand demonstration of the project's own
thesis -- an advisory's metadata ("fixed in version X") is not the same
as an empirically verified exploit -- and it surfaced *while building the
benchmark*, not while running it. It is being reported as a finding, not
edited out of the history.

---

## Experiment 2 — Evidence-completeness checker resolved paths incorrectly

**Hypothesis:** every `evidence[].file` the agent cites should resolve to
a real file under the fixture directory.

**Input:** First full 4-case evaluation run (pre-fix).

**Result:** `avg_evidence_completeness: 0.5` -- exactly the two cases
where the agent phrased cited paths as `fixtures/<case-id>/<path>`
(relative to this Claude Code session's own working directory, i.e. the
monorepo root) rather than `<path>` (relative to the fixture root, as the
prompt requested) failed verification. The other two cases, where the
agent used fixture-relative paths, passed at 100%.

**Failure/success:** Failure of the evaluation harness's path resolver,
not of the agent's citations -- both path conventions pointed at real
files; the checker only tried one resolution.

**Why:** The prompt says "relative to the repository root above" without
pinning down *which* root takes precedence when the agent's own tool
environment reports paths a different way; the agent's behavior was a
reasonable, still-literally-correct response to that ambiguity.

**Decision:** `resolveEvidenceFile()` in `scripts/evaluate.js` now tries
both the fixture-relative and repo-root-relative resolutions (and a raw
absolute-path fallback) before declaring a citation unverifiable. This is
a real fix to an ambiguity, not a relaxation of the check -- a citation
still fails if it does not resolve to an existing file with the claimed
line range in bounds.

**Next action:** Re-ran the full evaluation (Experiment 3) to confirm the
fix and get a clean, honest number.

---

## Experiment 3 — Full Tier A evaluation (Day-1 gate run)

**Hypothesis:** a single, unstructured agentic call (no multi-role
pipeline) equipped only with Read/Grep/Glob can correctly classify all
four Tier A reachability scenarios, with fully-verifiable evidence, at a
cost/latency compatible with a ~20-case benchmark.

**Input:** All 4 Tier A fixtures, corrected per Experiment 1, evaluated
via `node scripts/evaluate.js` (baseline + advanced, evidence-checked
against ground truth, evidence-completeness checker fixed per
Experiment 2).

**System version:** Single-agent advanced system (no pipeline roles
added), as specified in `docs/DAY1_IMPLEMENTATION_PLAN.md`.

**Result:** stored verbatim at
`evaluation/results/2026-08-29T05-28-25-444Z/results.json`.

| Metric | Baseline | Advanced |
|---|---|---|
| Exact verdict accuracy (4-way) | n/a (binary only) | 4/4 = 100% |
| Risk-classification accuracy (REACHABLE vs. not) | 2/4 = 50% | 4/4 = 100% |
| False positives | 2 (case-b, case-c) | 0 |
| False negatives | 0 | 0 |
| Evidence completeness (avg) | n/a | 4/4 = 100% |
| Total cost | $0 (no LLM calls) | $0.2636 for 4 cases (~$0.066/case) |
| Avg latency | ~0ms | ~30,152 ms/case |

Case-by-case:
- `case-a-reachable-minimist`: ground truth `REACHABLE`, baseline
  `VULNERABLE` (correct-as-risk-signal), advanced `REACHABLE` (exact
  match).
- `case-b-unreachable-minimist`: ground truth `NOT_REACHABLE`, baseline
  `VULNERABLE` (false positive), advanced `NOT_REACHABLE` (exact match).
- `case-c-condition-not-satisfied-lodash`: ground truth
  `CONDITION_NOT_SATISFIED`, baseline `VULNERABLE` (false positive),
  advanced `CONDITION_NOT_SATISFIED` (exact match).
- `case-d-indirect-minimist`: ground truth `REACHABLE` (reachable only via
  one hop of indirection through a wrapper module), baseline `VULNERABLE`
  (correct-as-risk-signal), advanced `REACHABLE` (exact match) -- the
  agent followed the import chain from the route handler into
  `lib/argvParser.js` without being told to.

**Failure/success:** Success on all four cases, including the two
predicted-as-risky cases (`case-c`'s precondition reasoning and `case-d`'s
indirection) called out in `docs/DAY1_IMPLEMENTATION_PLAN.md` Section 9 as
the most likely failure points for a single, unstructured agent call.
Neither predicted failure materialized.

**Decision:** Per the standing architectural rule (no role gets added
without a diagnosed failure that specifically justifies it), **no
additional agent role is justified by Tier A results.** The five-role
pipeline sketched in `docs/PROJECT_SELECTION.md` remains an unearned
ceiling. See `docs/ARCHITECTURE_DECISIONS.md` ADR-003.

**Next action:** Day-1 gate evaluated formally against
`docs/CVE_REACHABILITY_PLAN.md` Section 4 criteria -- see the Day-1 report
delivered alongside this log. Tier B (real-world repos) is the natural
next step, not a new pipeline role.
