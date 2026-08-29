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

---

## Experiment 4 — Tier B research halted by an auto-mode safety classifier

**Hypothesis:** a real-world Tier B benchmark of ~10-16 CVE/repository
pairs across several repositories could be assembled by (a) searching
GitHub code search for repos pinning known-vulnerable package versions,
(b) mining OSV.dev for real CVEs affecting an intentionally-realistic,
well-known open-source Node.js application, and (c) hand-verifying
reachability directly against the real source.

**What was actually done, in order:**
1. GitHub code search (`gh search code`) for repos pinning exact
   vulnerable `minimist`/`lodash` versions, and for real `lodash`
   `defaultsDeep()` usage. Unproductive -- legacy code search returned
   either nothing or mostly noise (monorepo fixtures, minified bundles),
   not usable real-world application code. `npms.io`'s `depended:`
   search qualifier (intended to find real dependents of a package) also
   returned zero results, suggesting that service's index is stale/dead.
2. GitHub's dependents graph for `minimist` (`/network/dependents`) was
   fetched directly and parsed. It surfaced mostly tiny, low-star,
   unrelated personal repositories rather than complex real applications
   -- not a productive source within a reasonable time budget.
3. Pivoted to **OWASP/NodeGoat**, a real, OWASP-maintained, intentionally
   realistic Express/MongoDB/Swig application built for security
   education, cloned at commit `c5cb68a7084e4ae7dcc60e6a98768720a81841e8`
   (2023-06-21). This was highly productive: real, still-present
   vulnerable dependencies (`underscore@1.9.1`, `marked@0.3.5`, plus
   transitive `lodash@4.17.11` and `minimist@0.0.10`) at genuinely
   different reachability depths, verified directly against the app's own
   source via `Grep`/`Read` (not assumed from the CVE description) --
   details in `evaluation/benchmarks/tier-b/manifest.json`.
4. While investigating a second real vulnerable-by-design application
   (DVNA, for repository diversity) to supplement NodeGoat, a `git clone`
   invocation was **blocked by an auto-mode safety classifier**, with an
   explicit statement that the block was about accumulated conversation
   content, not the specific command, and would keep firing for the rest
   of the session. Per the tool's own instruction not to rework or
   route around such a block, no further attempt was made to clone
   additional repositories.
5. The block turned out to be broader than just "clone a new repo": a
   subsequent plain `cp -r` (copying an already-legitimately-cloned local
   directory, no network access at all) was also blocked, and later, even
   `npm test` -- running this project's own pre-existing, previously
   unproblematic test suite -- was blocked. Unrelated commands (`git
   status`, `echo`, `pwd`) continued to work throughout, confirming the
   block was specific to this line of work, not a general Bash outage.

**Result:** Ground truth for 5 real cases from NodeGoat was authored and
frozen in `evaluation/benchmarks/tier-b/manifest.json` (Phases 1-3 of the
Day-2 instructions). The Tier B evaluation harness itself
(`scripts/evaluate_tier_b.js`) and its manifest-validation tests
(`tests/tier_b_manifest.test.js`) were written. **None of it has been
executed.** No baseline run, no advanced-agent run, no evidence
verification, no failure taxonomy, and no architecture decision exist for
Tier B as of this entry -- because Bash execution was not available to
produce them honestly, not because they were skipped by choice.

**Failure/success:** Failure to complete the assignment as scoped, for an
environmental reason outside the standing architectural process (this is
not a finding about the CVE-reachability system at all -- it is a
constraint on this automated session). Recorded plainly rather than
worked around, per this project's own standing rule against fabricating
results: better to report an honest partial result than a complete but
invented one.

**Decision:** No architecture decision can be made for Tier B yet -- there
is no evidence to base one on. `docs/ARCHITECTURE_DECISIONS.md` ADR-003
(no additional role justified by Tier A) stands unchanged and unextended.

**Next action:** A human needs to either (a) run
`evaluation/benchmarks/tier-b/fetch_repos.sh` then
`node scripts/evaluate_tier_b.js` from a normal (non-auto-mode) session or
a fresh session, and hand the resulting `evaluation/results-tier-b/*/results.json`
back for failure-taxonomy analysis, or (b) explicitly ask this session to
retry now that the immediate research task has stopped, in case the block
was tied to the specific research actions rather than the whole
remainder of the conversation as stated. Option (a) is the one the
classifier's own message points to.

---

## Experiment 5 — Tier B debugging arc and first successful run

**Hypothesis:** `scripts/evaluate_tier_b.js`, wired up in Experiment 4 but
never executed, would run against the frozen manifest and repo cache the
same way `scripts/evaluate.js` already does for Tier A.

**What actually happened, in order (all on Windows):**

1. `evaluation/benchmarks/tier-b/fetch_repos.sh` used `pwd` instead of
   `pwd -W` inside a Node subshell to resolve its own directory, which
   doubled the drive letter in the resulting path (e.g.
   `C:/c:/Users/...`) and broke every downstream path built from it. Fixed
   by using `pwd -W`.
2. `scripts/advanced/run_case.js`'s `resolveClaudeBinary()` returned the
   bare string `'claude'` on Windows. Node's built-in `spawnSync` cannot
   resolve `claude` to the actual `claude.cmd` shim without `shell: true`
   -- and `shell: true` would have broken argument escaping for the JSON
   schema and prompt text passed as CLI args. Fixed by switching to the
   `cross-spawn` package (`const spawnSync = require('cross-spawn').sync`),
   which resolves `.cmd` files and escapes arguments correctly across
   platforms without a shell.
3. The investigation prompt and the system prompt were both multi-line
   strings passed as raw CLI argument elements. On Windows, a multi-line
   string passed this way through the cross-spawn/`cmd.exe` argument
   chain gets silently truncated at the first newline -- confirmed by
   direct testing, where a 3-line probe prompt was received by the model
   as only its first line. This is the actual root cause behind every
   earlier Tier B attempt receiving no real task. Fixed by passing the
   investigation prompt via stdin (`spawnSync`'s `input` option, prompt
   removed from `args`) and by flattening the system prompt to a single
   line (`.join(' ')` instead of `.join('\n')` in
   `scripts/advanced/systemPrompt.js`) -- the system prompt does not
   depend on embedded newlines to function as instructions.
4. A related bug: the subprocess inherited the orchestrator's own working
   directory (and therefore its git status) instead of the fixture's,
   which the CLI auto-injects as ambient context -- causing the agent to
   reason about the orchestrator's own repo state and, in one case,
   address the researcher directly instead of investigating the target.
   Fixed by adding `cwd: fixtureAbsolutePath` to the `spawnSync` call.
5. Separately, in the evaluation harness itself: `checkEvidence()` in
   `scripts/evaluate_tier_b.js` called `fs.readFileSync` on any evidence
   entry whose cited path existed, without checking it was actually a
   file -- an entry citing a directory (e.g. a package folder under
   `node_modules`) crashed the harness with `EISDIR`. Fixed by adding
   `fs.statSync(c).isFile()` to the existence check, so a directory
   citation is correctly marked unverified instead of crashing the run.

**Result:** with all five fixes in place, `node scripts/evaluate_tier_b.js`
completed a real run against all 5 Tier B cases. Stored at
`evaluation/results-tier-b/2026-08-29T13-12-24-798Z/results.json`.

| Metric | Baseline | Advanced |
|---|---|---|
| Accuracy | 2/5 = 40% | 5/5 = 100% |
| False positives | 3 | 0 |
| False negatives | 0 | 0 |
| Avg confidence | n/a | 0.89 |
| Avg evidence completeness | n/a | 86.5% |
| Total cost | $0 | $0.5680 |
| Avg cost/case | $0 | $0.1136 |
| Avg duration/case | ~0 ms | ~54 s |

All 5 verdicts were exact matches against frozen ground truth. See
`docs/EVALUATION.md`'s Tier B Results section for the full per-case table
and `docs/TIER_B_REPORT.md` for the complete report.

**Failure/success:** Success, but with an important distinction worth
recording plainly: every failure that occurred on the way to this result
was an infrastructure/plumbing failure (path resolution, subprocess
argument passing, working-directory inheritance, a harness crash on an
edge-case citation shape) -- none was a reasoning failure of the advanced
agent itself. Once the agent actually received the real task (which,
per point 3 above, it had not been doing in earlier attempts), it reached
the correct verdict on all 5 cases including the two harder ones
(`tb-2`/`tb-3`, `tb-4`/`tb-5`) on the first try.

**Decision:** Per the standing "complexity is earned by failure" rule, no
specialized agent role (locator, path-tracer, condition analyst,
adversary, synthesizer) is justified -- there is no verdict failure
anywhere in Tier B to attach one to. This upgrades
`docs/ARCHITECTURE_DECISIONS.md` ADR-003 from a Tier-A-only finding to a
KEEP SINGLE AGENT decision now backed by a real Tier B run, superseding
Experiment 4's interim "no decision possible yet" placeholder. See
`docs/ARCHITECTURE_DECISIONS.md` ADR-005.

**Next action:** Per `docs/TIER_B_REPORT.md`'s recommendation: extend
Tier B with additional cases/repositories only if time allows before
submission; otherwise proceed to hardening/frontend work with this
benchmark's real limitations (n=5, single repository, 8 of 10 difficulty
categories, one evidence-quality caveat on `tb-1`) stated explicitly in
the submission rather than omitted.
