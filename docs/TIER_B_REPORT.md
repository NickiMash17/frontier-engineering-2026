# Tier B Report - Real-World Reachability Reality Test

Ground truth for a real-world benchmark was built, frozen, and then
actually evaluated. Getting to that point required finding and fixing
three separate Windows-specific bugs in the CLI-invocation path plus one
evaluator crash - the full account is in `docs/EXPERIMENT_LOG.md`
Experiments 4 and 5, and summarized in Section 9's "what happened"
account below. This report follows the required stop-report structure.

## 1. Benchmark

**5 cases**, all from one pinned commit of one real repository
(OWASP/NodeGoat, `c5cb68a7084e4ae7dcc60e6a98768720a81841e8`) - not the
~10-16-case, multi-repository benchmark originally scoped; a second
repository was in progress when an auto-mode safety classifier blocked
further Bash execution mid-build (`docs/EXPERIMENT_LOG.md` Experiment 4).
Full detail on every case in `evaluation/benchmarks/tier-b/manifest.json`.

Category distribution (a case can and does span more than one category):

| Category | Cases |
|---|---|
| Direct reachable usage | tb-2, tb-3 |
| Installed but unreachable | tb-1, tb-4, tb-5 |
| Reachable but condition absent (standalone) | **gap - documented, not filled** |
| Indirect usage | tb-2, tb-3 |
| Dead/unreachable application path | tb-1 |
| Transitive dependency context | tb-4, tb-5 |
| Attacker-control distinction | **gap - documented, not filled** |
| Sanitization/precondition case | tb-2 |
| Ambiguous case | tb-2 |
| Challenging real-world case | tb-2 |

8 of 10 originally requested difficulty categories are covered; the two
gaps are documented in `manifest.json`'s `documented_gaps`, not silently
dropped.

## 2. Baseline

Deterministic, code-blind version-range match (`scripts/baseline.js`,
unmodified from Tier A) against `data/advisories/index.json`. Flagged all
5 cases `VULNERABLE` - it has no way to know any of them are safe in
context, by design.

**Result: 2/5 correct (40% accuracy), 3 false positives, 0 false
negatives.**

## 3. Advanced v1

The same single, unstructured agent used for Tier A, run unmodified
(per the standing instruction not to improve it before the first Tier B
result) via `scripts/evaluate_tier_b.js`.

**Result: 5/5 correct (100% accuracy), 0 false positives, 0 false
negatives.** Avg confidence 0.89. Avg evidence completeness 86.5%. Avg
cost $0.1136/case. Avg duration 54s/case. Total cost across all 5 cases:
$0.5680.

## 4. Per-case results

| Case | Ground Truth | Baseline | Advanced | Correct? | Evidence Completeness | Duration | Cost |
|---|---|---|---|---|---|---|---|
| `tb-1-underscore-dead-import` | `NOT_REACHABLE` | `VULNERABLE` | `NOT_REACHABLE` | yes | 83% | 54s | $0.1106 |
| `tb-2-marked-sanitize-bypass` | `REACHABLE` | `VULNERABLE` | `REACHABLE` | yes | 100% | 44s | $0.0907 |
| `tb-3-marked-redos-same-sink` | `REACHABLE` | `VULNERABLE` | `REACHABLE` | yes | 100% | 40s | $0.0787 |
| `tb-4-lodash-pure-transitive` | `NOT_REACHABLE` | `VULNERABLE` | `NOT_REACHABLE` | yes | 71% | 44s | $0.1124 |
| `tb-5-minimist-pure-transitive` | `NOT_REACHABLE` | `VULNERABLE` | `NOT_REACHABLE` | yes | 78% | 87s | $0.1756 |

Source: `evaluation/results-tier-b/2026-08-29T13-12-24-798Z/results.json`.

## 5. Failures

**None at the verdict/classification level - all 5 cases were exact
matches.** Every failure encountered before this result was
infrastructure-level, not reasoning-level, and all were fixed before this
run:

1. `evaluation/benchmarks/tier-b/fetch_repos.sh` used `pwd` instead of
   `pwd -W` inside a Node subshell, doubling the drive letter in every
   resolved path.
2. `resolveClaudeBinary()` returned bare `'claude'`, which Node's built-in
   `spawnSync` can't resolve to `claude.cmd` on Windows without
   `shell: true` - which would have broken argument escaping for the
   JSON schema and prompt text. Fixed by switching to the `cross-spawn`
   package.
3. The investigation prompt and the system prompt were both multi-line
   strings passed as raw CLI arguments. On Windows, the
   cross-spawn/`cmd.exe` argument chain silently truncates such a string
   at its first newline - confirmed by direct testing, where a 3-line
   probe prompt arrived at the model as only its first line. **This was
   the actual root cause of every case receiving no real task in earlier
   attempts.** Fixed by passing the investigation prompt via stdin
   (`spawnSync`'s `input` option) and flattening the system prompt to one
   line.
4. A related bug: the subprocess inherited the orchestrator's own working
   directory (and its git status, auto-injected as ambient context by the
   CLI) instead of the fixture's, causing the agent to reason about the
   wrong repository and, in one case, address the researcher directly
   rather than investigate. Fixed by setting `cwd` to the fixture path.
5. In the evaluation harness itself: `checkEvidence()` crashed with
   `EISDIR` when an evidence entry cited a directory rather than a file.
   Fixed by checking `fs.statSync(c).isFile()`.

None of these were reasoning failures of the advanced agent - once it
actually received the real task, it reached the correct verdict on every
case on the first try, including the two pairs designed to be hard
(`tb-2`/`tb-3`'s misleading-mitigation case, `tb-4`/`tb-5`'s pure
transitive-dependency scoping question).

## 6. Evidence quality

Avg completeness 86.5%, driven down primarily by one specific, understood
gap rather than diffuse citation problems: **one entry in `tb-1`'s
evidence was marked unverified because the agent cited a search method**
("repo-wide grep for `require('underscore')`") **rather than a
file+line location** - the automated checker can only verify file-based
citations. This is an evaluator limitation, not an agent error: the
agent's underlying claim (no other file in the app references underscore)
was correct and matches the frozen ground truth, but the checker has no
way to verify a citation shaped as a search method rather than a
location. `tb-4` (71%) and `tb-5` (78%) show smaller versions of the same
pattern. `tb-2` and `tb-3` (100%) show the checker works cleanly when
citations are file+line shaped, which they were for these two.

Citation *validity* (file exists, line range in bounds) is what's
measured; citation *relevance* (does the cited text actually support the
specific claim) and verdict-level *completeness* were not automated for
this run, per the plan recorded in the prior version of this report - the
concrete gap surfaced above (search-method citations) is exactly the kind
of case a relevance-aware checker would need to handle next.

## 7. Generalization assessment

Tier A's split (100% advanced / 50% baseline, n=4) held up directionally
on Tier B as 100% advanced / 40% baseline (n=5) - real evidence the
mechanism holds beyond Tier A's controlled fixtures.

**Stated plainly, not overclaimed:** the two hardest patterns the
original plan predicted would be the real generalization test - a
sanitization bypass where the application's own mitigation is genuinely
present but insufficient (`tb-2`), and a framework-mediated indirect flow
(`tb-2`/`tb-3`'s route → DAO → template chain) - were each exercised
by exactly one pairing, not stressed repeatedly or varied. A clean 5/5 at
this sample size is real, meaningful evidence the single-agent approach
generalizes past controlled fixtures; it is not evidence it holds at
every level of real-world difficulty those two categories can produce.
This is a real, honest gap in what's been tested, not a confirmed pass on
the hardest possible version of these patterns.

## 8. Architecture decision

**KEEP SINGLE AGENT.**

No verdict failure was observed anywhere in Tier B. Per the standing
"complexity is earned by failure" rule, there is no evidence basis for
adding any specialized role (locator, path-tracer, condition analyst,
adversary, synthesizer) - each of those roles exists in the original plan
to fix a *specific, observed* failure mode, and none occurred. This is
now an evidence-backed decision made after a real 5-case run, superseding
the interim "no decision possible yet" placeholder this report carried
before the classifier block was resolved. See
`docs/ARCHITECTURE_DECISIONS.md` ADR-005.

## 9. Recommendation

Given the time spent on Windows-specific debugging to get a real run at
all, extend Tier B with additional cases/repositories **only if time
allows**. Otherwise, proceed to hardening/frontend work with this
benchmark's real limitations - n=5, single repository, 8 of 10 difficulty
categories, one evidence-checker gap on search-method citations - stated
explicitly in the submission rather than omitted.

## 10. Reproducibility

- **Clean environment:** `evaluation/benchmarks/tier-b/fetch_repos.sh`
  clones the pinned repository fresh from its public URL at its exact
  commit SHA - nothing is vendored.
- **Pinned benchmark:** `evaluation/benchmarks/tier-b/manifest.json` is
  frozen (see its own `note` field); any future correction must be logged
  in `docs/EXPERIMENT_LOG.md` as a discovery/correction entry, not
  silently edited.
- **All fixes documented:** the five fixes in Section 5 are each recorded
  in `docs/EXPERIMENT_LOG.md` Experiment 5 with the specific file and
  change.
- **Commands:**
  ```bash
  bash evaluation/benchmarks/tier-b/fetch_repos.sh
  node scripts/evaluate_tier_b.js
  ```
- **Git status:** reported as clean and pushed to `main` as of commit
  `775d96f`, plus this session's `checkEvidence` `isFile()` fix on top  - 
  stated here as reported, not independently re-verified by this
  automated session (git write operations were not available to it in
  this line of work; see Experiment 4).

---

## What actually happened (full account)

See `docs/EXPERIMENT_LOG.md` Experiments 4 and 5 for the complete,
chronological record: the code-search and dependents-graph approaches
that didn't pan out, the pivot to OWASP/NodeGoat that did, the auto-mode
safety classifier block that halted research on a second repository and
this session's ability to run or commit anything for the remainder of
that earlier work, and - in a later continuation - the five concrete
bugs found and fixed (three in the CLI-invocation path, one in
working-directory inheritance, one in the evaluation harness) that had
been silently causing every prior Tier B attempt to fail before producing
any real signal, followed by the clean 5/5 run this report documents.
