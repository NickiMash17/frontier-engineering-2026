# CVE Reachability — Application-Aware Vulnerability Triage

Frontier Engineering Challenge 2026 submission (individual, online).

## 1. Problem, User, Bottleneck

Security and dependency scanners (`npm audit`, Dependabot, Snyk) flag a
repository as "vulnerable" the instant an installed package version
matches a known CVE's affected range — regardless of whether the
application's code ever actually calls the vulnerable function, or
whether reaching it requires conditions that don't hold.

The people who feel this are **application security engineers and
backend teams triaging dependency-vulnerability alerts**, drowning in
low-signal noise: a scanner opens a ticket per CVE match, and a human
then spends 10–30 minutes per ticket manually opening the code, grepping
for usage, reading the advisory, and deciding "actually exploitable" vs.
"not reachable" — repeated dozens of times a week on any active repo.

The bottleneck is structural, not a tooling-quality gap: these scanners
only ever check *"is the package present at a vulnerable version,"*
never *"is the vulnerable code path reachable from anything the app
actually calls."* It's a version-matching problem dressed up as a
security-analysis problem. (See
[docs/PROJECT_SELECTION.md](docs/PROJECT_SELECTION.md), Candidate 1, for
the full analysis behind this choice, evaluated against eleven other
candidate problems.)

## 2. What This Project Does

Given a CVE that a conventional baseline scanner has already flagged, an
agent reads the actual target repository and determines whether the
vulnerable behavior is genuinely reachable from the application's own
code, under what conditions, and whether the relevant input is
attacker-controlled — producing a verdict (`REACHABLE` /
`NOT_REACHABLE` / `CONDITION_NOT_SATISFIED` / `UNCERTAIN`) backed by a
concrete file-and-line evidence trail that is independently re-verified
against the filesystem, not trusted from the agent's own claim.

## 3. Architecture

The advanced system is **one single, unstructured agent** — a headless
Claude Code CLI invocation restricted to `Read`/`Grep`/`Glob` (no shell,
no write access) — not the five-role pipeline (locator → path-tracer →
condition analyst → adversary → synthesizer) sketched early on in
[docs/PROJECT_SELECTION.md](docs/PROJECT_SELECTION.md).

**KEEP SINGLE AGENT** is a standing, evidence-backed decision
([docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md)
ADR-005): across both evaluation tiers (4 controlled fixtures, then 5
real-world cases from a pinned OWASP/NodeGoat commit), the single agent
produced zero verdict failures. Per the project's standing rule,
complexity is earned by a diagnosed failure, not added on the assumption
it will eventually be needed — with no diagnosed failure, no role has
been added. See ADR-001 (why a headless CLI call instead of an SDK
dependency) and ADR-005 (the full reasoning behind KEEP SINGLE AGENT) for
detail not repeated here.

## 4. Improvement Changelog

Every row traces to a real, checked-in artifact — no number below is
estimated. Full narrative for each stage is in
[docs/EXPERIMENT_LOG.md](docs/EXPERIMENT_LOG.md).

| Stage | What was tried and why | Evidence | Decision / Learning |
|---|---|---|---|
| **Day 1 — baseline + advanced build** | Deterministic version-match baseline (mirrors what `npm audit`/Dependabot actually do) plus a single-agent advanced system, against 4 self-authored, real-npm-package Tier A fixtures | `scripts/baseline.js`, `scripts/advanced/`, `fixtures/*/ground_truth.json` | Single-agent-first was deliberate: the five-role pipeline was scoped as an unearned ceiling from the start, not a design that got simplified later |
| **Day 1 — ground-truth calibration failure** | Assumed `minimist@1.2.5` / CVE-2021-44906 was exploitable per the advisory; the agent itself flagged doubt (`CONDITION_NOT_SATISFIED`, 0.85 confidence) instead of trusting the advisory | Independent `node -e` test against the real installed 1.2.5 package showed no pollution; a diff against 1.2.6 confirmed the guard already existed in 1.2.5 | Switched to `minimist@1.2.0` / CVE-2020-7598, empirically verified exploitable before reuse (Experiment 1) |
| **Day 1 — Tier A result** | Ran baseline + advanced against all 4 fixtures | `evaluation/results/2026-08-29T05-28-25-444Z/results.json` | **100% advanced vs. 50% baseline** risk-classification accuracy, 0 advanced false positives, 100% evidence completeness, $0.2636 total cost (~$0.066/case), ~30.2s avg latency. No diagnosed failure → KEEP SINGLE AGENT (ADR-003) |
| **Day 2 — Tier B benchmark built, execution blocked** | Built 5 real, hand-verified cases from OWASP/NodeGoat (pinned commit `c5cb68a7084e4ae7dcc60e6a98768720a81841e8`) after GitHub code search and the GitHub dependents graph both proved unproductive for finding real, complex, vulnerable-dependency repos | `evaluation/benchmarks/tier-b/manifest.json` | Ground truth frozen *before* any run — then an auto-mode safety classifier blocked all further Bash execution for the rest of that session (even plain `npm test`), reported as an environmental constraint on the automated session, not a finding about the system (Experiment 4) |
| **Day 2 (cont.) — 5 Windows-specific bugs found and fixed** | First real Tier B run attempt (later session) showed the agent receiving no real task | Direct testing showed a 3-line probe prompt arriving at the model as only its first line | Fixed, in order: (1) `pwd` vs. `pwd -W` path-doubling in the repo-fetch script, (2) `.cmd` resolution via the `cross-spawn` package (Node's built-in `spawnSync` can't resolve it without `shell:true`, which would break arg escaping), (3) the investigation prompt delivered via stdin instead of argv + the system prompt flattened to one line (root cause of the truncation), (4) subprocess `cwd` pinned to the fixture path (it was inheriting the orchestrator's own working directory/git status), (5) an `EISDIR` crash in the evidence checker on a directory-shaped citation (Experiment 5) |
| **Day 2 — Tier B result** | Ran `scripts/evaluate_tier_b.js` against all 5 real cases after the fixes | `evaluation/results-tier-b/2026-08-29T13-12-24-798Z/results.json` | **100% advanced vs. 40% baseline** accuracy, 0 advanced false positives/negatives, avg confidence 0.89, avg evidence completeness 86.5%, $0.5680 total cost (~$0.114/case), ~54s avg latency. Every failure on the way here was infrastructure (path/subprocess/harness), never agent reasoning — KEEP SINGLE AGENT now backed by two independent tiers (ADR-005) |
| **Hardening** | Tier B surfaced a real evidence-quality gap: a search-method citation (e.g. *"repo-wide grep for `require('underscore')`"*) was marked unverified because the checker only understood file+line citations | `tb-1`'s evidence completeness read 83% for a correct, well-reasoned `NOT_REACHABLE` verdict | Added an optional `type: "file" \| "search"` field to the evidence schema (backward compatible, defaults to `"file"`); `checkEvidence` now treats a search entry as its own valid category, not a failed file citation; added a regression test asserting the full multi-line prompt survives via stdin, never argv |
| **Frontend** | Built a vanilla HTML/CSS/JS dashboard (zero framework, zero build step) directly over the real result JSON already in the repo | `frontend/`, `scripts/frontend/generate_data.js` | No demo/mock data path exists anywhere — every number rendered traces to one of the two real runs above. Results Dashboard, CVE Investigation Detail, Evidence Panel, and Baseline-vs-Advanced Comparison are built; the replay-landing and pipeline-animation screens are not yet built |

## 5. How to Run It

```bash
npm install
```

**Tests** (deterministic, free, no API calls):

```bash
npm test
```
> Test coverage was extended alongside the work above (Tier B manifest
> validation, evidence-type handling, a prompt-delivery regression guard),
> but an auto-mode safety classifier blocked Bash execution in this
> session for long stretches (see Section 4 and Experiment 4/5) — not
> every test added since Day 1 has been confirmed passing by an actual
> `npm test` run in this repository. Run it yourself before relying on it.

**Baseline only** (naive version-match scanner, free, no API calls):

```bash
npm run baseline                                              # all Tier A fixtures
node scripts/baseline.js fixtures/case-a-reachable-minimist   # one fixture
```

**Advanced, single case** (requires a working, authenticated Claude Code
installation — `$CLAUDE_CODE_EXECPATH` or `claude` on `PATH`; real cost
and latency, see Section 4 for what to expect):

```bash
node scripts/advanced/run_case.js fixtures/case-a-reachable-minimist CVE-2020-7598
```

**Full Tier A evaluation** (baseline + advanced, all 4 fixtures):

```bash
npm run evaluate
```

**Full Tier B evaluation** (real repo, real cost/time):

```bash
bash evaluation/benchmarks/tier-b/fetch_repos.sh   # clones OWASP/NodeGoat at its pinned commit
node scripts/evaluate_tier_b.js
```

**Frontend** — regenerate the data, then serve it (do **not** open
`frontend/index.html` by double-clicking; browsers block ES module
imports from `file://` origins — see
[docs/FRONTEND_PLAN.md](docs/FRONTEND_PLAN.md) Section 1):

```bash
node scripts/frontend/generate_data.js   # writes frontend/data/generated/*.js from the latest real runs
cd frontend
npx serve .                              # or: python -m http.server
# then open the URL it prints
```

## 6. Main Failure Mode / Hot Take

> **Draft only — this is a suggested starting point, not a final claim.**
> The framing below is what the raw experience seems to point to, but
> which lesson actually mattered most is a judgment call about the whole
> project, and that call belongs to Nicolette, not to an automated
> summary of the logs.

Across two full evaluation tiers and every real CVE/repository pair
tested, **the agent's reasoning never failed once** — 4/4 exact matches
on Tier A, 5/5 on Tier B, including cases specifically chosen to be hard
(multi-hop indirection, a sanitization setting the target application's
own code comments claimed was "the fix" for exactly the CVE that
defeats it). Every actual failure on the way to those results was
somewhere else entirely: a doubled drive letter from `pwd` vs. `pwd -W`,
a `.cmd` shim `spawnSync` couldn't resolve without breaking argument
escaping, a multi-line prompt silently truncated at its first newline by
the Windows argv-passing chain, a subprocess inheriting the wrong working
directory, a crash on a directory-shaped citation. A possible hot take:
*on this project, the hard part of shipping a reliable agent wasn't
getting the model to reason correctly — it was getting a Windows
subprocess to hand the model its actual task intact.* Whether that's the
one sentence worth repeating to a judge, versus the reachability-vs-
presence framing in Section 1, is Nicolette's call to make.

## Further Reading

- [docs/PROJECT_SELECTION.md](docs/PROJECT_SELECTION.md) — why this problem, chosen against 11 other candidates
- [docs/CVE_REACHABILITY_PLAN.md](docs/CVE_REACHABILITY_PLAN.md) / [docs/DAY1_IMPLEMENTATION_PLAN.md](docs/DAY1_IMPLEMENTATION_PLAN.md) — how the Day-1 system was planned and built
- [docs/EXPERIMENT_LOG.md](docs/EXPERIMENT_LOG.md) — every experiment, in order, including the two full accounts this changelog summarizes
- [docs/EVALUATION.md](docs/EVALUATION.md) — full Tier A and Tier B methodology and results
- [docs/TIER_B_REPORT.md](docs/TIER_B_REPORT.md) — the primary Tier B technical report
- [docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) — every ADR, including ADR-005 (KEEP SINGLE AGENT)
- [docs/FRONTEND_PLAN.md](docs/FRONTEND_PLAN.md) — frontend design, data contract, and the file:// serving requirement
- [CLAUDE.md](CLAUDE.md) — the engineering constitution this project follows throughout
