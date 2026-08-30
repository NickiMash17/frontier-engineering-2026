# Day-1 Implementation Plan - CVE Reachability Vertical Slice

Status: planning complete, implementation follows this document. Written
after empirically probing the chosen agent-runtime mechanism (Section 3)
rather than assuming it would work.

## 1. Answers to the Phase-1 Inspection Questions

**1. What implementation structure is appropriate?**
A small set of independent, composable pieces, not a framework: real
fixture repos, a deterministic baseline script, an agent-invocation
script, and an evaluation harness that runs both against the same
fixtures and diffs against ground truth. No web server, no database, no
UI yet - those come after the gate (per the standing plan).

**2. What language/runtime?**
Node.js for all harness code (`node --test` for tests, no framework).
This matches the chosen npm/JavaScript ecosystem for fixtures and needs
no extra install - Node ships a built-in test runner. Fixture apps are
also plain Node/CommonJS, written to look like real Express route
handlers (a recognizable, realistic idiom) but never executed - the
whole point of this system is static/agentic reading, not dynamic
execution, so fixtures do not need `express` actually installed.

**3. What agent framework, if any, is actually justified?**
None, as a dependency. The "agent" is a headless invocation of the
Claude Code CLI itself (`claude -p ...`), reusing this machine's existing
authenticated session - no `ANTHROPIC_API_KEY` needed, no SDK dependency
to add. This was validated empirically (Section 3), not assumed.

**4. What tools does the agent minimally need?**
`Read` and `Glob`. `Grep` is added for efficient text search once
fixtures exist (not yet probed, but it is a standard built-in tool with
the same permission model as Read/Glob, so the same sandboxing applies).
No `Bash`, `Edit`, or `Write` - the agent cannot execute or modify
anything, only read and search, which is sufficient for a static
reachability investigation and satisfies "no unnecessary shell/system
privileges."

**5. What can remain deterministic instead of being delegated to an LLM?**
Everything in the baseline (version parsing, range matching against the
saved OSV advisory records) is plain code - no LLM involved. In the
advanced system, discovering *which* CVEs apply to *which* installed
versions is also deterministic (same code as the baseline); only the
reachability *investigation* for CVEs the baseline already flagged is
delegated to the agent. The agent is never asked to determine whether a
version is in a vulnerable range - that's arithmetic, not judgment.

**6. What must be evaluated independently of the agent's own claims?**
Every cited evidence location (`file`, `lines`) is checked
programmatically - file exists, line range exists - before being counted
as valid evidence in the evaluation harness. The agent's stated
`confidence` is recorded but never substituted for the ground-truth
comparison; accuracy is computed by comparing `verdict` against the
hand-authored `ground_truth.json` per fixture, not against the agent's
self-report.

## 2. Architecture

```text
fixtures/<case>/                  - real npm fixture apps (Phase 2)
  package.json, package-lock.json - real installed vulnerable package
  src/...                         - route handlers, real code
  ground_truth.json               - hand-authored, deterministic

data/advisories/                  - real OSV.dev records, pinned (Section 4)
  CVE-2021-44906.json
  CVE-2019-10744.json

scripts/baseline.js                - Phase 3: naive version-match scanner
scripts/advanced/run_case.js       - Phase 4: invokes the Claude Code CLI
scripts/advanced/prompt.js         - prompt template + JSON schema
scripts/evaluate.js                - Phase 5: runs both, scores against
                                      ground truth, writes evaluation/results/

evaluation/results/<timestamp>/    - machine-readable run output
```

## 3. Agent-Runtime Mechanism (validated)

The advanced agent is a headless call to the Claude Code CLI binary
(path from `$CLAUDE_CODE_EXECPATH`), one call per fixture case:

```text
claude -p "<prompt with absolute fixture path + advisory facts>"
  --system-prompt "<short, narrow system prompt>"
  --safe-mode
  --tools "Read,Grep,Glob"
  --add-dir "<absolute fixture directory>"
  --output-format json
  --json-schema "<schema from Section 5>"
  --model sonnet
  --no-session-persistence
  --max-budget-usd 1.00
```

Three things were learned by direct experiment before committing to this,
not assumed:

1. **`--permission-mode bypassPermissions` gets the invocation blocked**
   by this session's own auto-mode classifier (nested-agent-with-bypassed-
   permissions is treated as a risky pattern). The fix is to not use it  - 
   restricting `--tools` to read-only tools plus scoping `--add-dir`
   sandboxes the call adequately on its own; file-system access outside
   the allowed directory is denied cleanly (`permission_denials` in the
   output) rather than hanging, even with no TTY attached.
2. **The default system prompt costs ~90K cache-creation tokens per cold
   call (~$0.30+ before any real work).** Passing a short custom
   `--system-prompt` and `--safe-mode` (skip CLAUDE.md/skills/plugin
   discovery) cuts a validated probe call from $0.36 to $0.017 - a ~20x
   cost reduction that matters directly for the benchmark's own "cost per
   case" metric.
3. **The agent does not infer its working directory from `--add-dir`.**
   The absolute path must be stated explicitly in the prompt, or the
   agent guesses wrong paths, gets denied, and silently fabricates an
   answer instead of failing loudly. The prompt template (Section 5)
   always states the absolute fixture path and instructs the agent to
   `Glob` it first.

Output shape (confirmed): the CLI's JSON result includes top-level
`structured_output` (the parsed object matching `--json-schema`),
`total_cost_usd`, `duration_ms`, and `permission_denials` - all four are
used directly in the evaluation harness (verdict comparison, cost metric,
latency metric, and a sanity check that the agent didn't get denied
access to something it needed).

**Reproducibility implication:** reproducing the advanced system requires
Claude Code itself (an authenticated `claude` binary on `PATH` or
resolvable via env), not just Node. This is stated plainly in the
reproduction instructions rather than glossed over - it is an accurate
reflection of what was actually built, not a limitation to hide.

## 4. Advisory Data (real, pinned)

> **Correction made during Day-1 execution:** the table below originally
> pinned `minimist@1.2.5` / CVE-2021-44906. Empirical testing (running the
> real exploit payload against the real npm-installed 1.2.5 tarball)
> showed 1.2.5 is not actually exploitable by the standard payload shape  - 
> the advisory's "fixed in 1.2.6" framing does not mean 1.2.5 itself is
> vulnerable to it. Replaced with CVE-2020-7598 / `minimist@1.2.0`,
> confirmed exploitable by direct experiment. Full account in
> `docs/EXPERIMENT_LOG.md` Experiment 1. Left uncorrected here would be
> exactly the kind of unverified-advisory-metadata trust this whole
> project argues against.

Two real CVEs, chosen for clean npm-ecosystem SEMVER ranges and enough
public detail to state exact vulnerable-symbol and version-range facts
without guessing -- and, after Experiment 1, verified exploitable by
direct execution against the real installed package, not just trusted
from advisory text:

| CVE | Package | Vulnerable range | Fixed | Vulnerable symbol | Source |
|---|---|---|---|---|---|
| CVE-2020-7598 (GHSA-vh95-rmgr-6w4m) | `minimist` | `<0.2.1` or `1.0.0–<1.2.3` | `0.2.1` / `1.2.3` | `setKey()` - unguarded `--__proto__.<key>=<value>` | OSV.dev, fetched live; empirically verified |
| CVE-2019-10744 (GHSA-jf85-cpcp-j695) | `lodash` | `<4.17.12` | `4.17.12` | `defaultsDeep()` | OSV.dev, fetched live; empirically verified |

Both are real, well-documented prototype-pollution advisories: the
package must be called with an attacker-influenced object/key structure
containing `__proto__`/`constructor.prototype` for exploitation, which is
exactly the kind of precondition that makes "present vs. reachable vs.
exploitable" a meaningful three-way distinction - not a two-way
present/absent one. Raw OSV.dev JSON for both is saved under
`data/advisories/` as the pinned source of truth; nothing about them is
invented.

## 5. Advanced Output Contract

```json
{
  "cve": "string",
  "package": "string",
  "installed_version": "string",
  "vulnerable_symbol": "string",
  "usage_sites": ["string"],
  "reachable_path": ["string"],
  "required_conditions": ["string"],
  "attacker_controlled_input": true,
  "verdict": "REACHABLE | NOT_REACHABLE | CONDITION_NOT_SATISFIED | UNCERTAIN",
  "confidence": 0.0,
  "evidence": [{"file": "string", "lines": "string", "detail": "string"}],
  "uncertainties": ["string"]
}
```

Enforced via `--json-schema`; `additionalProperties: false` and all
fields required, so the agent cannot substitute prose for evidence (no
schema slot exists for an unsupported claim like "looks reachable").

## 6. Baseline (Phase 3)

Reads each fixture's `package.json`/`package-lock.json`, extracts the
resolved installed version of the packages named in
`data/advisories/*.json`, and does a plain numeric version-range check
(no `semver` dependency - the two ranges in scope are simple enough for
a ~15-line comparator, and adding a dependency for this is not justified
at this scope). Baseline verdict is binary: `VULNERABLE` if the installed
version falls in the advisory's range, else `NOT_VULNERABLE`. No code
awareness, no usage inspection - this is the literal current-practice
strawman the advanced system must beat.

## 7. Tier A Benchmark Design

Four fixtures, two real CVEs, chosen so each fixture isolates one
reachability situation cleanly:

| Case | Package@version | Scenario | Ground truth |
|---|---|---|---|
| A - reachable | `minimist@1.2.0` | HTTP handler passes a JSON request body's array field directly into `minimist()` and returns the parsed result | `REACHABLE` |
| B - installed but unreachable | `minimist@1.2.0` | Only referenced in a `scripts/build.js` dev script never invoked by the running server; server code never imports it | `NOT_REACHABLE` |
| C - reachable package, condition not satisfied | `lodash@4.17.11` | HTTP handler calls `_.defaultsDeep()` on request-derived data, but an upstream whitelist strips any `__proto__`/`constructor`/`prototype` keys before the merge | `CONDITION_NOT_SATISFIED` |
| D - indirect/challenging | `minimist@1.2.0` | HTTP handler calls a local wrapper module (`lib/argvParser.js`) which itself calls `minimist()` - reachable, but only via one hop of indirection a shallow single-file search could miss | `REACHABLE` |

Case D exists specifically to probe whether a single, unstructured agent
call follows import chains beyond the first file it finds - this is the
concrete signal Phase 6 (failure analysis) needs to decide whether a
dedicated path-tracing step is actually earning its place, rather than
being added on the assumption that it will be needed.

Ground truth for all four is authored by hand in each fixture's
`ground_truth.json` at construction time - the LLM never decides it, per
the standing requirement.

## 8. Evaluation Metrics (Phase 5)

- Classification accuracy (baseline vs. advanced) against `ground_truth.json`.
- False positives (flagged as risk when ground truth says otherwise) and
  false negatives, computed per verdict category.
- Evidence completeness: fraction of cited `evidence[].file`/`lines`
  entries that are verified to exist and match the claimed content.
- Analysis time and cost per case, taken directly from the CLI's own
  `duration_ms` / `total_cost_usd` fields - not separately estimated.
- Deferral correctness: whether `UNCERTAIN` is used only where the
  fixture is actually ambiguous (none of the four Tier A cases are
  designed to be genuinely ambiguous - that is reserved for Tier B - so
  for Tier A, any `UNCERTAIN` verdict counts as incorrect).

## 9. Expected Failure Modes (predictions to check against actual results)

- Case D may be answered `NOT_REACHABLE` if the agent stops at the route
  handler and doesn't open the wrapper module - the single most likely
  failure, and the one most directly informative for the architecture
  question.
- Case C may be over-called `REACHABLE` if the agent finds the
  `defaultsDeep` call but doesn't register the upstream sanitization step
  as a real precondition-blocker.
- Evidence citations may reference plausible-sounding but wrong line
  numbers if the agent reasons from a partial read rather than the exact
  file content - this is exactly why evidence is checked
  programmatically rather than trusted.

These are hypotheses, not results - Section 10 of the eventual report
will state what actually happened against these predictions.

## 10. Day-1 Pass/Fail Criteria

Restated from `docs/CVE_REACHABILITY_PLAN.md` Section 4, unchanged:
correct verdict on all cases in the controlled pair used for the gate,
every cited evidence entry verified real, and per-case cost/latency
compatible with running ~20 cases later. Gate is evaluated in Phase 7
exactly as written - see that document for the authoritative criteria and
the fallback decision.

## 11. Explicit Scope Boundaries (Day 1)

In scope: 4 Tier A fixtures, deterministic baseline, single-agent
(no multi-role pipeline) advanced system, evaluation harness, failure
analysis, gate decision.

Out of scope today: Tier B real-world repos, any additional agent role,
UI, and anything from the five-role pipeline beyond a single unstructured
agent call - those are earned by Section 9's actual results, not
scheduled in advance.
