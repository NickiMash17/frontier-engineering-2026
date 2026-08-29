# Tier B Report — Real-World Reachability Reality Test

**This report cannot answer the question it was commissioned to answer.**
Ground truth for a real-world benchmark was successfully built; the
evaluation itself could not be run. Both facts are reported here in full,
because the alternative -- filling in the missing half with a plausible
estimate -- is exactly the kind of fabrication this project's own
standing rules prohibit. This document follows the required stop-report
structure precisely, including the sections that have to say "not
available" rather than a number.

## 1. Benchmark

**5 cases**, all from one pinned commit of one real repository
(OWASP/NodeGoat, `c5cb68a7084e4ae7dcc60e6a98768720a81841e8`) — not the
~10-16-case, multi-repository benchmark originally scoped. See Section 7
for why, and `evaluation/benchmarks/tier-b/manifest.json` for the frozen
detail on every case.

Category distribution (a case can and does span more than one category):

| Category | Cases |
|---|---|
| Direct reachable usage | tb-2, tb-3 |
| Installed but unreachable | tb-1, tb-4, tb-5 |
| Reachable but condition absent (standalone) | **gap — documented, not filled** |
| Indirect usage | tb-2, tb-3 |
| Dead/unreachable application path | tb-1 |
| Transitive dependency context | tb-4, tb-5 |
| Attacker-control distinction | **gap — documented, not filled** |
| Sanitization/precondition case | tb-2 |
| Ambiguous case | tb-2 |
| Challenging real-world case | tb-2 |

## 2. Baseline

**Not run.** `scripts/baseline.js`'s logic applies unchanged to Tier B
(it already reads `data/advisories/index.json`, now extended with the
three new advisories this benchmark needed), but it has not been executed
against the Tier B manifest in this session.

## 3. Advanced v1

**Not run.** `scripts/advanced/run_case.js` (the same single, unstructured
agent used for Tier A, unmodified, per the standing instruction not to
improve it before the first Tier B result) is wired into
`scripts/evaluate_tier_b.js`, which has not been executed.

## 4. Per-case results

**Not available.** No case has been run.

## 5. Failures

**Not available.** No failure taxonomy can be built without a run to
analyze.

## 6. Evidence quality

**Not available for execution results.** What *was* done, per Phase 10's
request to improve the evaluator beyond "the cited file/line exists":

- `scripts/evaluate_tier_b.js`'s evidence check is currently at the same
  maturity as Tier A's — citation *validity* (file exists, line range in
  bounds), not citation *relevance* (does the text at that location
  actually support the specific claim) or verdict-level *completeness*
  (is the cited evidence, taken together, sufficient to support the
  verdict). Improving this was scoped for after a real Tier B run
  produced cases to calibrate against — building a relevance/completeness
  checker against zero real runs would be designing in the dark.
- The manual-verification protocol Phase 10 asks for when semantic
  verification can't be automated: for each case, compare the advanced
  agent's `evidence[]` entries against the `ground_truth_evidence[]`
  entries already frozen in `manifest.json` — a human (or a second,
  independent review pass) reads both citation sets side by side and
  judges whether the agent's citations actually support its stated
  verdict, using the frozen ground-truth evidence as the answer key. This
  is documented now, ready to apply the moment a real run exists.

## 7. Generalization assessment

**Cannot be made.** This is the section the whole exercise exists to
produce, and it requires the run in Sections 2-3. What can be said
honestly:

- Tier A predicted the single-agent architecture would handle multi-hop
  indirection (`case-d`) and precondition/sanitization reasoning
  (`case-c`) without failure, and it did. Tier B's `tb-2` and `tb-3`
  cases were specifically chosen to stress a harder version of exactly
  that: indirection through two files instead of one, and a
  precondition the *target application itself* believes is satisfied via
  a stated mitigation that the specific CVE defeats. Whether the
  single-agent system handles that additional layer of difficulty is
  precisely what Section 2-3's missing run would show.
- `tb-4` and `tb-5` (pure transitive dependencies, never required by the
  application at all) test a scoping question Tier A never posed: does
  the agent correctly conclude "not reachable from this application" for
  a package the application never touches, rather than treating every
  installed package as equally in-scope? This is a real generalization
  question Tier A's fixtures (which always had the vulnerable package
  directly required somewhere) could not test.

## 8. Architecture decision

**KEEP SINGLE AGENT** — not because Tier B evidence supports it (there is
none yet), but because there is no evidence of any failure to justify
changing it. The standing rule (`docs/ARCHITECTURE_DECISIONS.md` ADR-003)
already states a role is added only when a diagnosed failure specifically
justifies it; absent a Tier B run, that bar plainly has not been met, so
the architecture does not change. This is a decision about what *not* to
do given no new evidence, not a validated generalization claim.

## 9. Recommendation

Two concrete, sequential next actions:

1. **Execute Tier B.** From a session with normal Bash access (a fresh
   session, or this one continued outside auto mode — see Section 7):
   ```bash
   bash evaluation/benchmarks/tier-b/fetch_repos.sh
   node scripts/evaluate_tier_b.js
   ```
   Then re-run this report's Sections 2-8 against the real
   `evaluation/results-tier-b/*/results.json` output, following the exact
   failure-taxonomy and architecture-decision process the Day-2
   instructions specify (Phases 6-9) — none of that process is skipped,
   it simply has no data yet to run on.
2. **Only after that**, decide whether Tier B's second repository (and
   the two documented category gaps) are worth pursuing further, now that
   whatever caused the research block is no longer live in a fresh
   session.

## 10. Reproducibility

- **Clean environment:** `evaluation/benchmarks/tier-b/fetch_repos.sh`
  clones the pinned repository fresh from its public URL at its exact
  commit SHA — nothing is vendored.
- **Pinned benchmark:** `evaluation/benchmarks/tier-b/manifest.json` is
  frozen (see its own `note` field) — any future correction must be
  logged in `docs/EXPERIMENT_LOG.md` as a discovery/correction entry, not
  silently edited.
- **Reproducible commands:** listed in Section 9.
- **Test status:** `tests/tier_b_manifest.test.js` validates the
  manifest's internal consistency (every case references a declared
  repository, has a valid verdict and a matching advisory entry, REACHABLE
  cases declare a reachable path, NOT_REACHABLE cases don't, gaps are
  documented) — **written but not run** in this session; `npm test` was
  blocked along with everything else described in Section 7. It has not
  been confirmed to pass.
- **Git status:** all Tier B artifacts (`data/advisories/*` additions,
  `evaluation/benchmarks/tier-b/*`, `scripts/evaluate_tier_b.js`,
  `tests/tier_b_manifest.test.js`, this report, and the other doc updates)
  exist in the working tree. Whether they are committed depends on
  whether `git add`/`git commit` were also affected by Section 7's
  block — reported plainly, not assumed, in the message accompanying this
  report.

---

## What actually happened (full account)

See `docs/EXPERIMENT_LOG.md` Experiment 4 for the complete, chronological
record: the code-search and dependents-graph approaches that didn't pan
out, the pivot to OWASP/NodeGoat that did, and the exact point (attempting
to clone a second repository for diversity) where an auto-mode safety
classifier began blocking further Bash execution in this line of work —
a block that turned out to cover not just new external fetches but even
locally re-running this project's own pre-existing test suite, while
leaving unrelated commands (`git status`, `echo`) unaffected throughout.
No attempt was made to reword or route around it, per its own explicit
instruction; this report and the accompanying stop-message are the
"stop and tell the user" step that instruction asked for.
