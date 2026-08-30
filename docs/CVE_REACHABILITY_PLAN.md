# CVE Reachability Triage  -  Feasibility, Benchmark & Vertical-Slice Plan

Status: planning only. No agents, pipelines, or application code have been
built as a result of this document. This is the DISCOVER → PLAN step that
precedes BASELINE.

## 0. Decision Record

- **Primary:** Reachability-Aware CVE Triage Agent.
- **Fallback:** Accessibility Violation Remediation Agent  -  switch to it
  only if the Day-1 gate (Section 4) fails and cannot be fixed same-day.
- **Architecture stance:** Do not pre-commit to the five-role pipeline
  (`locator → path-tracer → condition analyst → adversary → synthesizer`)
  from the selection document. That division of labor is a *hypothesis*
  about what the advanced system needs, not a starting requirement. It
  gets adopted role-by-role, only when the simplest version demonstrably
  fails in a way that role would fix.
- **Research question the whole project answers:** *Can an agentic system
  reduce false-positive vulnerability alerts by establishing
  application-specific exploitability evidence, measured against a fixed
  benchmark of real CVEs in real repos?*

## 1. What "Reachability Analysis" Actually Requires

Stripped of framing, the task is: given a CVE advisory and a target
repository, decide whether the vulnerable behavior described in the
advisory can actually be triggered by something the application exposes
(an HTTP handler, a CLI argument, a message consumer  -  anything an
external actor influences), and cite the evidence.

This does **not** require building a general-purpose static-analysis
engine (a call-graph compiler, a points-to analysis, a taint tracker).
That would be the wrong scope for 3 days and is not how the "agentic"
differentiation is supposed to work. Instead, the agent uses ordinary
code-reading tools  -  search for the vulnerable symbol, read the files
that import it, read the files that call those files, follow that chain
outward from the flagged usage toward whatever counts as an application
entry point  -  the same process a human security engineer does manually,
just automated and made to show its work.

**Implication for architecture:** the tool surface an agent needs is
small  -  code search (grep-equivalent), file read, and a way to enumerate
likely entry points (route/handler definitions, `main`/CLI entry, exported
package API). It does not need a custom static-analysis backend to start.

## 2. Ecosystem Choice: JavaScript/npm

Recommending **npm/JavaScript** over PyPI/Python for the benchmark, for
three concrete reasons:

1. Usage sites are easy to locate mechanically (`require(...)` /
   `import ... from ...`), which keeps the "locate usage" step reliable
   even before any LLM reasoning is applied.
2. A large set of well-known npm CVEs already have public write-ups
   describing *exactly* the conditions needed to trigger them (prototype
   pollution via `minimist`/`lodash`, ReDoS via `minimatch`/`ansi-regex`,
   algorithm-confusion in `jsonwebtoken`, unsafe deserialization patterns)
    -  this converts ground-truth verification from "trace it ourselves
   from scratch" into "verify against an existing credible source,"
   directly addressing the Day-1-curation risk flagged in the selection
   doc.
3. Small, self-authored demo apps that use these packages in a
   reachable vs. non-reachable way are trivial to write in JavaScript,
   which we need anyway for the controlled half of the benchmark
   (Section 3).

This is a reversible choice  -  if Day 1 shows npm-specific friction, PyPI
is the documented fallback ecosystem, not a from-scratch rethink.

## 3. Benchmark Design

Two tiers, both needed:

### Tier A  -  Controlled pairs (self-authored, ground truth by construction)

For 3–4 well-documented CVEs, write two minimal demo apps each:
one where the vulnerable function is reachable from an external input,
one where the same package/version is present but the vulnerable path is
provably dead (unused export, feature-flagged off, only invoked with
hardcoded/non-attacker-controlled arguments). This tier exists specifically
to make the Day-1 gate (Section 4) fast and unambiguous  -  we already know
the right answer because we wrote it.

### Tier B  -  Real-world pairs (public repos, hand-verified ground truth)

10–16 real CVE + real public-GitHub-repo pairs, pinned to exact commit
SHAs, spanning:
- clearly reachable (attacker input flows to the vulnerable sink)
- clearly not reachable (present but dead/unused/gated)
- genuinely borderline (reachable only under a rare config, or via
  dynamic dispatch that's hard to trace statically)  -  these are the
  cases that should make the agent say "Uncertain" rather than guess,
  and they are the cases most likely to reveal which additional agent
  roles are actually earning their place.

Total benchmark size: ~15–20 cases (Tier A + Tier B combined), matching
the size committed to in the selection document.

**Ground-truth sourcing shortcut:** before manually tracing any Tier B
case from scratch, check whether OSV.dev already lists the affected
symbol/function for that advisory (it does for some ecosystems) and
whether a public write-up or PoC already documents the trigger
conditions  -  use that as the starting point for verification, not a full
independent trace. Budget: half a day maximum for all of Tier B curation;
if it's running over, cut to n=10 for Tier B and say so plainly rather
than slipping the schedule.

## 4. Day-1 Validation Gate

**Goal:** prove or disprove, on the cheapest possible slice, that an
agent equipped only with code-search + file-read tools can correctly
distinguish reachable from non-reachable for a single controlled pair,
with a legible evidence trail.

**Procedure:**
1. Pick one Tier A pair (e.g., a prototype-pollution package used
   directly on parsed request input in app A, and only in a build script
   never invoked at runtime in app B).
2. Give a single agent: the CVE advisory text, the target repo, and
   generic code-search/read tools. No pipeline, no role division. Ask it
   to output a verdict (Reachable / Not Reachable / Uncertain), a
   confidence, and cited file:line evidence.
3. Run it against both apps in the pair.

**Pass criteria (all required):**
- Correct verdict on both apps in the pair.
- Every cited file:line reference is real and says what the agent claims
  (checked programmatically, not by eye).
- Completes in a time/cost budget compatible with running ~20 cases in
  the full benchmark later (order-of-magnitude check, not a hard SLA).

**If it fails:** diagnose *why* before adding structure  - 
- Wrong verdict because it never found the real call site → the gap is
  search/tool coverage, not missing agent roles.
- Wrong verdict because it stopped one hop too early in the call chain →
  this is the concrete evidence that justifies adding an explicit
  path-tracing step.
- Right call site, but overclaimed reachability without checking whether
  the path is actually invoked anywhere → this is the concrete evidence
  that justifies an adversarial self-check step.
- Citations don't check out → the gap is output discipline (force
  citation verification before display), not architecture.

**If it fails and can't be fixed same day:** pivot to Accessibility
Violation Remediation per the standing fallback decision. No sunk-cost
continuation.

## 5. Vertical Slice → Full Benchmark, Incrementally

1. Day 1: single-agent version passes the gate on one controlled pair.
2. Extend to the rest of Tier A (3–4 pairs) with the same single-agent
   version, unmodified except for whatever the gate diagnosis in Section
   4 actually required.
3. Run against Tier B. Expect new failure modes from real-world messiness
   (indirection, re-exports, monorepo structure, dynamic requires). Each
   new class of failure gets one targeted fix  -  either a tool
   capability (e.g., a bounded-hop search strategy) or, if and only if
   the failure is a reasoning-structure problem rather than a tool-
   coverage problem, one additional agent role.
4. Only once the pipeline has earned every role it has, lock the
   architecture and run the full benchmark for the metrics table.

This keeps the five-role design from the selection document as the
**ceiling**, not the starting point  -  matching the required
BASELINE → MEASURE → IDENTIFY FAILURE → IMPROVE sequence instead of
designing the advanced architecture before seeing where the simple
version actually breaks.

## 6. Metrics (unchanged from selection doc, restated for this slice)

Precision / recall / F1 of "genuinely exploitable" classification vs. the
baseline's flag-everything behavior; false-positive-rate reduction;
citation accuracy; latency and cost per case; rate of correct deferral to
"Uncertain." No number gets reported that doesn't trace to a stored raw
agent transcript in the repo.

## 7. Three-Day Time Budget (revised around the gate)

- **Day 1 AM:** Tier A demo apps + baseline script (naive version-match
  against OSV/GHSA) + Day-1 gate run. Go/no-go decision by early
  afternoon.
- **Day 1 PM:** If go  -  Tier B curation (capped at half a day) run in
  parallel with extending the agent to the rest of Tier A.
- **Day 2:** Run full benchmark, diagnose failures, add only the agent
  roles the evidence demands, re-measure. Start UI in parallel once the
  pipeline shape is stable, not after.
- **Day 3:** Polish UI, finalize evidence-citation verification, write
  the changelog/reproduction docs, record the demo video, run the
  submission audit checklist.

## 8. What This Document Deliberately Does Not Do

It does not pick final agent names, final UI framework, or lock the
five-role architecture. Those follow the gate result and the failure
diagnosis in Sections 4–5, not this document.
