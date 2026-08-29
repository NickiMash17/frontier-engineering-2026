# Project Selection — Frontier Engineering Challenge 2026

Status: strategic discovery only. No application code, dependencies, or
architecture has been implemented as a result of this document. Repository
state at time of writing: initial commit `606ff69` only.

---

## 1. Competition Objective

Choose one specific, painful, real problem; solve it with agents; prove —
with a fixed benchmark and real numbers — that an "advanced" agentic
solution measurably beats a simple baseline at the same task; make every
claim reproducible from a clean environment; ship a polished end-to-end
product and a ≤5-minute demonstration that tells that story.

The deliverable is not "an agent." The deliverable is **evidence that
agentic engineering improved a specific outcome**, packaged in a product
good enough that a judge trusts it on sight.

## 2. Judging Strategy

| Criterion | Weight | What actually earns points |
|---|---|---|
| Problem & User Value | 15% | A real person with this exact pain, named specifically — not "developers" or "businesses" |
| Agent Solution & Engineering | 30% | Multiple agents *only if each has a non-redundant job*; clear reasoning traces; sound architecture |
| End-to-End Quality | 20% | It runs, it's fast enough to demo live, the UI explains the system rather than decorating it |
| Measured Improvement | 15% | A fixed benchmark, run identically against baseline and advanced, real numbers, no cherry-picking |
| Reproducibility | 15% | A stranger clones the repo and gets the same numbers with no tribal knowledge |
| Hot Take / Insight | 5% | One sentence a judge would repeat to a colleague |

**Reading of the weights:** Agent Solution & Engineering (30%) and End-to-End
Quality (20%) are half the score together. This punishes two common
failure modes: (a) a single well-prompted LLM call dressed up as "agents"
with no real division of labor, and (b) a working backend with a
throwaway UI. It also punishes over-engineering — a five-agent pipeline
that isn't measurably better than three agents is *worse* engineering, not
better, under this rubric.

## 3. Design Principles Carried Into Candidate Selection

1. Reject the explicitly banned categories (chatbot, RAG app, resume
   builder, generic coding assistant, generic multi-agent research
   assistant, summarizer, task manager) even in disguised form.
2. Prefer problems with a **closed-loop, mechanically checkable ground
   truth** (a linter, a checker, an injected known-answer, a public
   advisory database) over problems whose "correctness" is subjective —
   subjective ground truth quietly destroys the Measured Improvement and
   Reproducibility criteria (30% combined) no matter how good the demo
   looks.
3. Prefer problems where the **baseline is what the industry already does
   today** — this makes "improves how the task is handled today" a
   literal, defensible claim instead of a rhetorical one.
4. Prefer problems solvable with **public or self-generated data**, never
   real PII, real patient records, or scraped private data.
5. Every agent role must be justified by a distinct failure mode it
   catches. If one well-tooled agent can do the job, ship one agent.
6. Scope every candidate assuming **one person, ~3 days, including
   evaluation, polish, documentation and video** — not 3 days of ideal
   engineering time.

---

## 4–5. Candidate Problems — Full Analysis

### Candidate 1 — Reachability-Aware Vulnerability Triage Agent

1. **Problem:** Security/dependency scanners (`npm audit`, Dependabot,
   Snyk) flag a repo as "vulnerable" the instant a package version matches
   a known CVE's affected range — regardless of whether the app's code
   ever calls the vulnerable function, or whether reaching it requires
   conditions that don't hold.
2. **User:** Application security engineers and backend teams who triage
   dependency-vulnerability alerts and are drowning in low-signal noise.
3. **Current workflow:** SCA tool opens a ticket per CVE match; a human
   manually opens the code, greps for usage, reads the advisory, and
   decides "actually exploitable" vs "not reachable" — 10–30 minutes per
   ticket, done dozens of times a week on active repos.
4. **Bottleneck:** The scanners only check "is the package present at a
   vulnerable version," never "is the vulnerable code path reachable from
   anything the app actually calls." This is a version-matching problem
   pretending to be a security-analysis problem.
5. **Agent opportunity:** Determining reachability requires reading an
   advisory, locating usage sites in a real codebase, tracing a call chain
   from an entry point to the vulnerable sink, checking preconditions
   stated in the advisory, and then *adversarially re-checking its own
   claim* before asserting "exploitable." That is a multi-step
   investigation with tool use (search, read, cross-reference) — not a
   single prompt.
6. **Baseline:** Reimplement what current SCA tools do — match installed
   package version against known-vulnerable ranges from a public advisory
   database (OSV/GHSA) and flag every match. No code awareness.
7. **Advanced solution:** A locator agent finds where the flagged
   package/symbol is imported and called; a path-tracer agent walks the
   call chain from application entry points toward the flagged sink; a
   condition-analyst agent checks advisory-stated preconditions against
   the code; an adversary agent tries to *refute* the reachability claim;
   a synthesizer emits a verdict (Reachable / Not Reachable / Uncertain)
   with a cited file:line evidence trail.
8. **Evaluation:** Fixed set of ~15–20 real CVEs paired with real public
   GitHub repos at pinned commits, hand-verified as reachable /
   not-reachable / borderline. Metrics: precision/recall/F1 of
   "genuinely exploitable" classification vs. the baseline's
   flag-everything behavior; false-positive-rate reduction (headline
   number); evidence-citation accuracy (do the cited file:line references
   actually exist and say what the agent claims); cost and latency per
   case; % of cases correctly deferred to "Uncertain" rather than
   guessing.
9. **Data:** Public OSV/GHSA advisories and public GitHub repositories
   pinned to exact commit SHAs. No auth, no PII, no licensing issue.
10. **Demo:** Live "before/after" board — "Naive scanner flags 42 issues →
    agent confirms 9 exploitable, deprioritizes 33 with cited evidence" —
    then drill into one case and show the actual call-path evidence a judge
    can verify by opening the linked file.
11. **UI/UX:** An investigation board, one card per CVE, expandable into an
    evidence timeline (advisory → usage found → call path → condition
    check → adversary transcript → verdict + confidence). Baseline column
    vs. advanced column side by side.
12. **Failure modes:** Hallucinated call paths (mitigated by requiring
    citations that are programmatically verified to exist before display);
    genuinely ambiguous reachability from dynamic dispatch/reflection
    (must degrade to "Uncertain," not guess); large repos blowing the tool-
    call budget (mitigate with a bounded-hop search from the flagged
    symbol outward); vague advisories that don't name a specific function.
13. **Reproducibility:** Fully reproducible — pinned commits, pinned
    advisory IDs, a single script re-clones everything and regenerates the
    metrics table from raw stored agent transcripts.
14. **Three-day feasibility:** Moderate risk concentrated in Day 1 dataset
    curation (manually verifying ground truth for 15–20 cases). Scoping to
    one ecosystem (npm or PyPI) makes this tractable; timeboxed to a half
    day with a fallback to n=10.
15. **Differentiation:** Reachability-aware SCA exists commercially
    (Snyk, Socket.dev, Endor Labs) — we do not claim novelty of the
    *concept*. The differentiation is doing it as a transparent,
    tool-using agentic pipeline with a cited evidence trail and an
    adversarial self-check an individual can build and rigorously
    benchmark in days, against a baseline that is literally what free/
    common tooling does today.

### Candidate 2 — Accessibility Violation Remediation Agent

1. **Problem:** Automated accessibility checkers (axe-core, WAVE) find
   WCAG violations but don't fix them; commercial "fixes" (accessibility
   overlays) patch the rendered page cosmetically without touching source
   and are widely criticized as not actually helping disabled users.
2. **User:** Frontend teams under legal/compliance pressure (ADA/WCAG) who
   get a violation report and then do the real work of fixing it by hand.
3. **Current workflow:** Run a checker, get a list of violations with a
   rule ID and DOM node, manually map each to source, write a fix, re-run
   the checker, repeat.
4. **Bottleneck:** Checkers only classify; they don't localize to source,
   don't propose a correct fix, and don't verify the fix didn't break
   layout/behavior.
5. **Agent opportunity:** Mapping a DOM-level violation back to the
   source file/component, generating a fix appropriate to that violation
   type (not a generic template), and verifying the fix both resolves the
   violation *and* doesn't visually regress the page requires multiple
   distinct reasoning steps and a real feedback loop against a checker —
   not one prompt.
6. **Baseline:** Run axe-core, report the violation list as-is (what every
   team already has today).
7. **Advanced solution:** A locator agent maps each DOM violation to the
   owning source file/component; a fixer agent proposes a targeted code
   patch per violation type (alt text, contrast, label association, focus
   order, ARIA role); a verifier agent re-runs the checker against the
   patched build to confirm resolution; a visual-diff critic agent flags
   any patch that changes rendered layout beyond a tolerance, forcing a
   retry.
8. **Evaluation:** A demo web app we build ourselves with 15–20 seeded
   violations spanning WCAG categories (some easy, some genuinely
   ambiguous, e.g. decorative-vs-informative images). Metrics: violations
   resolved (baseline: 0, since it only reports); regression rate (patches
   that broke something, caught by visual diff); severity-weighted score
   before/after; iterations-to-fix; human-intervention rate on ambiguous
   cases.
9. **Data:** Self-authored demo app with deliberately seeded violations —
   fully self-contained, no external data or licensing question.
10. **Demo:** Live browser view, violation highlighted, agent reasoning
    shown, patch applied, page re-rendered, checker re-run live, violation
    gone — highly visual, no narration needed to prove it worked.
11. **UI/UX:** Split view — rendered page on one side, evidence/reasoning
    log on the other; before/after WCAG score; per-violation trail
    (detected → localized → patched → verified).
12. **Failure modes:** Fix technically passes the checker but is
    semantically wrong (e.g., meaningless alt text) — needs a semantic-
    quality check, not just a pass/fail from the checker; patches that fix
    one violation but introduce another; ambiguous cases (decorative vs.
    informative) needing a human-approval gate rather than a forced
    guess.
13. **Reproducibility:** Fully self-contained (our own demo app + open-
    source checker) — a stranger clones the repo, runs the harness, gets
    identical before/after scores with no external dependency.
14. **Three-day feasibility:** Lowest-risk candidate on this axis — no
    external data sourcing, no third-party API, checker is deterministic
    and fast.
15. **Differentiation:** Accessibility overlays and static checkers both
    exist; the differentiator is closed-loop, source-level, verified
    remediation (fix is proven by re-running the same checker, not just
    asserted) — directly contrasting with the overlay industry's approach.

### Candidate 3 — Production Incident Root-Cause Investigation Agent

1. **Problem:** When a service degrades, on-call engineers manually
   correlate logs, metrics, traces, and recent deploys to find the actual
   root cause — a slow, high-stress, error-prone process (MTTR is a
   universally tracked, universally painful SRE metric).
2. **User:** On-call SREs/backend engineers during an active incident.
3. **Current workflow:** Open four different dashboards, eyeball
   timestamps, guess at correlation, often land on the wrong cause first.
4. **Bottleneck:** No single tool correlates all four signal types
   (logs/metrics/traces/deploys) into one causal narrative; it's manual
   cross-referencing under time pressure.
5. **Agent opportunity:** Forming a root-cause hypothesis from multiple
   heterogeneous signal streams, then actively searching for
   confirming/disconfirming evidence across those streams, is a genuine
   multi-step investigative process well beyond one prompt.
6. **Baseline:** Keyword/timestamp correlation — surface the log lines and
   metric anomalies nearest the alert's timestamp, no causal reasoning.
7. **Advanced solution:** An investigator agent forms hypotheses from the
   alert; an evidence-gatherer agent queries logs/metrics/traces/deploy
   history for each hypothesis; a verifier agent checks each hypothesis
   against the timeline for consistency; a synthesizer ranks hypotheses by
   evidence strength and produces a causal narrative with citations.
8. **Evaluation:** A synthetic multi-service telemetry generator with
   ~15–20 injected known-root-cause incidents (e.g., a bad deploy, a
   connection-pool exhaustion, a downstream timeout cascade) — since we
   inject the cause, we have perfect ground truth. Metrics: top-1/top-3
   root-cause accuracy, time-to-diagnosis, evidence-citation accuracy.
9. **Data:** Fully synthetic, generated by us — no sourcing risk, but real
   engineering effort to make it non-trivially realistic.
10. **Demo:** "Detective board" reconstructing an incident timeline live,
    ruling hypotheses in/out with evidence, landing on the true cause.
11. **UI/UX:** Timeline scrubber with logs/metrics/traces overlaid;
    hypothesis list with live confidence bars; evidence citations per
    hypothesis.
12. **Failure modes:** Synthetic telemetry too clean/unrealistic, making
    the benchmark less credible; agent overfits to injected-incident
    patterns; real incidents rarely have one clean root cause, which the
    demo's crispness may misrepresent.
13. **Reproducibility:** Reproducible in principle (seeded generator), but
    the generator itself is nontrivial infrastructure that must also be
    documented and shipped.
14. **Three-day feasibility:** Highest engineering overhead of the three
    finalists — building a credible synthetic telemetry generator is real
    work *before* any agent work starts.
15. **Differentiation:** Multi-signal causal correlation with an
    adversarial verification step and a fully-controlled, ground-truth
    benchmark (rare in this space, where most demos are un-evaluated).

### Candidate 4 — Deployment Change-Risk Assessor

1. **Problem:** Teams merge PRs without a reliable signal for "how likely
   is this specific change to cause an incident," relying on gut feel or
   blanket process (mandatory staging soak, manual sign-off).
2. **User:** Release managers / engineers deciding whether a change is
   safe to ship now.
3. **Current workflow:** Checklist-based release gating, or nothing at
   all beyond CI passing.
4. **Bottleneck:** CI passing measures correctness-in-isolation, not
   blast-radius or historical risk correlation (e.g., "changes to this
   file class have caused 3 of our last 5 incidents").
5. **Agent opportunity:** Correlating a diff against historical
   incident/rollback data and current system state to produce a risk
   score with justification requires reasoning across code + history, not
   one prompt.
6. **Baseline:** Static heuristic (lines changed, files touched, "hot
   file" count) — a crude but real current-practice proxy.
7. **Advanced solution:** Agents that read the diff semantically, cross-
   reference historically risky patterns/files, check test coverage of
   the changed paths, and produce a risk score with rationale.
8. **Evaluation:** Requires a corpus of historical PRs labeled
   "caused incident / did not" — realistically only available as a
   synthetic/labeled construction, which weakens ground-truth credibility.
9. **Data:** Would need synthetic PR history with fabricated
   incident-correlation labels — the weakest data story of all twelve
   candidates.
10. **Demo:** Risk score + rationale on a PR — less visually dramatic than
    other candidates.
11. **UI/UX:** A risk badge on a PR view with contributing-factor
    breakdown.
12. **Failure modes:** Ground truth is inherently our own construction —
    high risk of the benchmark being circular (we label what "risky"
    means, then measure whether the agent agrees with our own labels).
13. **Reproducibility:** Fine mechanically, weak evidentially.
14. **Three-day feasibility:** Moderate — real effort goes into
    constructing a defensible labeled corpus, which is exactly the part
    most vulnerable to critique.
15. **Differentiation:** Overlaps substantially with Candidate 3;
    doesn't clearly stand on its own.

### Candidate 5 — Invoice / PO Three-Way-Match Discrepancy Investigator

1. **Problem:** Accounts-payable teams manually reconcile invoice, PO, and
   receipt documents to catch billing errors and fraud before paying.
2. **User:** AP clerks / controllers.
3. **Current workflow:** Manual or rules-based matching (exact field
   match); mismatches get kicked to a human queue with no explanation.
4. **Bottleneck:** Rules-based matching produces high false-positive
   mismatch queues (formatting differences, partial shipments) and misses
   semantic discrepancies (quantity split across multiple deliveries).
5. **Agent opportunity:** Reasoning about *why* documents disagree
   (legitimate partial delivery vs. real discrepancy) is a judgment call
   suited to agentic reasoning over structured+unstructured document data.
6. **Baseline:** Exact-field rules matching (what RPA/ERP tools already
   do).
7. **Advanced solution:** Extraction agent parses the three documents;
   reconciliation agent semantically matches line items across
   formatting/splitting differences; an investigator agent explains any
   true discrepancy with evidence; a fraud-pattern critic flags
   statistically unusual vendor behavior.
8. **Evaluation:** Synthetic invoice/PO/receipt triples (10–20) with known
   injected discrepancy types; measure false-positive queue reduction and
   discrepancy-explanation accuracy.
9. **Data:** Fully synthetic — reasonable to build, no sourcing risk.
10. **Demo:** Solid but functionally "back-office," lower emotional pull.
11. **UI/UX:** Reconciliation queue with evidence per flagged item.
12. **Failure modes:** Real-world documents (scanned PDFs, varied
    formats) are messier than anything we can synthesize in 3 days,
    which risks an unrealistically clean benchmark.
13. **Reproducibility:** Straightforward — self-contained synthetic data.
14. **Three-day feasibility:** High — well-scoped, low infra needs.
15. **Differentiation:** Low — this is a heavily automated RPA space
    already; hard to make it feel distinctive rather than "another
    invoice bot."

### Candidate 6 — Commercial Lease Abstraction & Renewal-Risk Agent

1. **Problem:** Commercial real estate teams manually extract obligations,
   dates, and risk clauses from lease PDFs to track renewal deadlines and
   liabilities.
2. **User:** CRE portfolio managers / paralegals.
3. **Current workflow:** Manual read-and-tag of long lease documents into
   a tracking spreadsheet.
4. **Bottleneck:** Slow, error-prone manual extraction; missed renewal
   deadlines carry real financial cost.
5. **Agent opportunity:** Extracting structured obligations from long,
   inconsistent legal documents and flagging risk clauses (auto-renewal
   traps, escalation clauses) benefits from multi-pass extraction +
   verification against the source text.
6. **Baseline:** Keyword/regex extraction of dates and defined terms.
7. **Advanced solution:** Extractor agent pulls structured obligations;
   a risk-flagging agent identifies clauses matching known-risky patterns;
   a verifier agent checks every extracted fact against a quoted source
   span (no un-cited claims).
8. **Evaluation:** 10–20 leases with hand-labeled ground truth for key
   dates/clauses; measure extraction accuracy and risk-flag precision.
9. **Data:** Real commercial leases are not freely available/licensable at
   scale; realistic option is LLM-generated synthetic leases, which
   weakens "real-world" credibility of the ground truth we're grading
   against (we would be grading against our own construction).
10. **Demo:** Reasonably compelling but text-heavy, less visual.
11. **UI/UX:** Document viewer with extracted-obligation sidebar, each
    item linked to its source span.
12. **Failure modes:** Synthetic-lease realism; legal nuance the agent
    misreads with high confidence (dangerous in a legal-adjacent domain).
13. **Reproducibility:** Fine mechanically; ground-truth credibility is
    the weak point.
14. **Three-day feasibility:** Moderate — synthetic data generation +
    careful hand-labeling takes real time.
15. **Differentiation:** Moderate; legal-document abstraction agents are
    a known space.

### Candidate 7 — Clinical Trial Eligibility Matching Agent

1. **Problem:** Matching a patient to eligible clinical trials requires
   reading dense, jargon-heavy eligibility criteria against a patient's
   full record — done manually by research coordinators today.
2. **User:** Clinical trial coordinators / oncology nurse navigators.
3. **Current workflow:** Manual cross-reference of ClinicalTrials.gov
   criteria against a patient chart.
4. **Bottleneck:** Time-intensive, and criteria contain compound/negated
   logic ("no prior therapy with X unless Y") easy to misread.
5. **Agent opportunity:** Parsing compound eligibility logic and matching
   it against structured+unstructured patient data, then justifying each
   inclusion/exclusion with a citation, is naturally multi-step.
6. **Baseline:** Keyword overlap between patient record and criteria text.
7. **Advanced solution:** Criteria-parser agent converts free-text
   eligibility into structured logic; a matcher agent evaluates that logic
   against the patient record; a verifier agent checks each match/reject
   against the source criterion and flags ambiguous cases for human
   review.
8. **Evaluation:** Synthetic patients (via a tool like Synthea) against
   real ClinicalTrials.gov criteria, with 10–20 hand-verified match/
   no-match cases; measure precision/recall vs. baseline.
9. **Data:** Real trial criteria are public (ClinicalTrials.gov API);
   patients must be synthetic for compliance — a defensible combination,
   but assembling and validating it well takes real time.
10. **Demo:** Emotionally resonant (real patients, real trials context)
    but requires care not to overstate clinical reliability.
11. **UI/UX:** Patient-to-trial match list with per-criterion
    include/exclude rationale and citations.
12. **Failure modes:** High stakes if over-trusted — must be framed
    explicitly as a coordinator-assist tool, never an autonomous clinical
    decision-maker; compound negated logic is genuinely hard to get
    reliably right.
13. **Reproducibility:** Reasonable — public criteria + a documented
    synthetic-patient generation process.
14. **Three-day feasibility:** Elevated risk — synthetic patient
    generation, criteria-logic parsing, and careful hand-verified ground
    truth is a lot to build well solo in 3 days.
15. **Differentiation:** Strong domain resonance, but healthcare-matching
    agents are a well-populated space; also more likely to draw scrutiny
    on responsible-use grounds given the domain's stakes.

### Candidate 8 — Insurance Claim Denial Appeal Copilot

1. **Problem:** Patients/providers whose insurance claims are denied must
   write an appeal citing policy language and medical necessity — a
   process most people find opaque and are ill-equipped to do well.
2. **User:** Patients or clinic billing staff appealing a denial.
3. **Current workflow:** Manual letter-writing, often abandoned because
   it's confusing; appeal success rates are low partly from under-effort.
4. **Bottleneck:** No structured way to map a denial reason to the
   specific policy clause and evidence needed to contest it.
5. **Agent opportunity:** Reading a denial reason, matching it against
   policy text and medical-necessity evidence, and drafting a targeted
   appeal is multi-step reasoning over heterogeneous documents.
6. **Baseline:** Generic appeal-letter template filled with patient
   details.
7. **Advanced solution:** A denial-classifier agent identifies the actual
   denial reason category; a policy-matcher agent finds the specific
   clause governing it; an evidence-gatherer agent assembles supporting
   documentation; a drafting agent writes a targeted, citation-backed
   appeal.
8. **Evaluation:** This is the candidate's fatal weakness — "did the
   appeal succeed" ground truth requires a real payer decision, which we
   cannot obtain or simulate credibly. Any benchmark we build is
   necessarily a proxy (e.g., "does it cite the correct policy clause"),
   which is a real but much weaker measured-improvement story.
9. **Data:** Real denial letters/policies are sensitive and hard to source
   legally; synthetic denials are buildable but the eval-strength problem
   above remains regardless of data quality.
10. **Demo:** Emotionally the most compelling story of all twelve
    candidates — but emotional resonance cannot substitute for the
    Measured Improvement criterion (15% of score).
11. **UI/UX:** Denial reason mapped to policy clause mapped to drafted
    appeal, each with citations.
12. **Failure modes:** Overpromising outcome ("this will win your appeal")
    when we cannot actually validate real-world success rates — a
    responsible-use concern as well as an evaluation-strength one.
13. **Reproducibility:** Fine mechanically, weak evidentially for the same
    reason as #9.
14. **Three-day feasibility:** Achievable to build, but the evaluation
    story cannot be fixed in 3 days no matter how much time we spend —
    it's a structural limitation, not a time limitation.
15. **Differentiation:** High user-value salience (this is a widely-felt,
    high-emotion pain point) undermined by the hardest evaluation problem
    on the list.

### Candidate 9 — Phishing / BEC Email Investigation Copilot

1. **Problem:** Security analysts triage suspicious emails (headers,
   links, sender history) to determine if they're a real phishing/BEC
   attempt, largely by hand.
2. **User:** SOC analysts / IT security staff.
3. **Current workflow:** Manual header inspection, link-checking via
   external tools, sender cross-reference.
4. **Bottleneck:** Slow per-email manual process; inconsistent depth of
   investigation across analysts.
5. **Agent opportunity:** Correlating header anomalies, link
   reputation, and sender-history context into a single evidenced verdict
   is a real multi-signal investigation.
6. **Baseline:** Keyword/rule-based phishing heuristics (what many
   basic filters already do).
7. **Advanced solution:** Header-analyst agent checks SPF/DKIM/DMARC and
   routing anomalies; link-analyst agent inspects URLs/domains; sender-
   history agent checks consistency with prior communication; synthesizer
   produces a verdict with evidence.
8. **Evaluation:** Public phishing corpora (e.g., Nazario corpus) plus
   synthetic legitimate email for negatives; measure precision/recall vs.
   baseline heuristics.
9. **Data:** Usable public corpora exist, but robust link/sender-
   reputation analysis benefits from external APIs (WHOIS, URL
   reputation) which introduces rate limits, possible auth requirements,
   and non-determinism — a reproducibility risk for judges without keys.
10. **Demo:** Strong — a clear "here's the smoking gun in the headers"
    narrative.
11. **UI/UX:** Email viewer annotated with flagged header/link/sender
    evidence, verdict with confidence.
12. **Failure modes:** External API dependency breaks clean-environment
    reproducibility; corpus provenance/licensing needs care.
13. **Reproducibility:** Weakened by external service dependencies unless
    scoped to fully offline heuristics, which in turn weakens the
    advanced solution's edge over baseline.
14. **Three-day feasibility:** Good if scoped offline-only; the
    temptation to add reputation APIs is a real scope-creep risk.
15. **Differentiation:** Solid, but sits in a crowded "AI phishing
    detection" space with less distinctive positioning than Candidate 1.

### Candidate 10 — CI Test Flakiness Root-Cause Agent

1. **Problem:** Flaky tests (pass sometimes, fail sometimes with no code
   change) erode trust in CI and waste engineering time re-running builds.
2. **User:** Backend/platform engineers maintaining a CI pipeline.
3. **Current workflow:** Re-run and hope, or manually inspect logs across
   multiple runs to guess at a cause (race condition, unseeded randomness,
   test-order dependency, flaky network call).
4. **Bottleneck:** No systematic correlation across historical runs to
   isolate the actual nondeterminism source.
5. **Agent opportunity:** Comparing passing vs. failing run logs/diffs and
   forming a root-cause hypothesis (with a way to *test* that hypothesis
   by re-running under controlled conditions) is genuinely investigative.
6. **Baseline:** Flag the test as "flaky" based on pass/fail variance
   alone — no cause.
7. **Advanced solution:** An evidence-gatherer agent collects historical
   run data for the test; a hypothesis agent proposes a cause (race
   condition / ordering / external dependency / unseeded random); a
   verifier agent re-runs the test under a condition designed to
   confirm/refute the hypothesis (e.g., forcing test order, mocking the
   network call).
8. **Evaluation:** Seed 10–20 known flaky patterns into a demo test suite
   (controllable ground truth, similar strategy to Candidate 3); measure
   root-cause accuracy and time-to-diagnosis vs. baseline's "just flagged
   as flaky."
9. **Data:** Self-authored — low sourcing risk.
10. **Demo:** Good for a developer audience, narrower appeal than security/
    accessibility for a general judging panel.
11. **UI/UX:** Run-history timeline with hypothesis and confirming/
    refuting evidence per hypothesis.
12. **Failure modes:** Some flakiness genuinely requires production-scale
    conditions to reproduce, which a demo suite can't capture — mitigated
    by only seeding patterns we can control.
13. **Reproducibility:** Strong — fully self-contained, deterministic
    seeding.
14. **Three-day feasibility:** Good — narrower scope than Candidates 1–3.
15. **Differentiation:** Reasonable, but a narrower, more niche audience
    than the top candidates limits User Value score.

### Candidate 11 — Privacy Data-Flow Compliance Auditor

1. **Problem:** Engineering teams claim certain data-handling practices in
   a privacy policy, but nothing verifies that the actual codebase's data
   flows match those claims (e.g., "we don't share X with third parties"
   while a code path actually does).
2. **User:** Privacy/compliance engineers, DPOs.
3. **Current workflow:** Manual, ad hoc code review against policy text,
   rarely systematic.
4. **Bottleneck:** No tooling connects "what the policy says" to "what the
   code actually does" at the data-flow level.
5. **Agent opportunity:** Tracing where a named data category (e.g. email
   address) enters, moves through, and exits a codebase, then comparing
   that trace against policy claims, is a multi-step code-reasoning task.
6. **Baseline:** Keyword search for privacy-relevant terms in code (e.g.,
   grep for "email", "ssn") with no flow tracing.
7. **Advanced solution:** A data-flow-tracer agent follows a named data
   category from entry point to all sinks (logs, third-party calls,
   storage); a policy-comparison agent checks each sink against policy
   claims; a verifier flags contradictions with cited evidence.
8. **Evaluation:** Requires a codebase with deliberately seeded
   compliant/non-compliant data flows and a matching policy document —
   buildable, but real data-flow tracing across arbitrary code patterns
   is technically hard to make robust in 3 days without narrowing scope
   drastically (single language, single framework).
9. **Data:** Self-authored demo codebase + policy — low sourcing risk, but
   nontrivial to construct convincingly.
10. **Demo:** Interesting to a compliance-literate judge, less immediately
    graspable to a general audience than the top three.
11. **UI/UX:** Data-flow graph with policy-claim overlay, contradictions
    highlighted.
12. **Failure modes:** Scope creep — "arbitrary codebase data-flow
    analysis" is a research-grade static-analysis problem if not tightly
    bounded to one small demo app.
13. **Reproducibility:** Good if self-contained.
14. **Three-day feasibility:** Elevated risk — the underlying analysis is
    the hardest engineering problem on this list to make genuinely robust,
    not just demo-scripted.
15. **Differentiation:** Novel combination (policy text + code data-flow),
    but execution risk is high relative to payoff.

### Candidate 12 — Warranty / Return Fraud Investigation Agent

1. **Problem:** Retailers lose money to return/warranty fraud (serial
   returners, mismatched receipts, wardrobing) that simple rule engines
   catch inconsistently.
2. **User:** Retail loss-prevention / customer-ops teams.
3. **Current workflow:** Rule-based flags (return count thresholds) with
   high false-positive rates, frustrating legitimate customers.
4. **Bottleneck:** Rules don't reason about context (legitimate reasons
   for a return pattern vs. actual fraud signals).
5. **Agent opportunity:** Investigating a flagged case across receipt
   data, return history, and product data to produce a reasoned judgment
   is more nuanced than a threshold rule.
6. **Baseline:** Rule-based thresholding (current common practice).
7. **Advanced solution:** An investigator agent gathers case evidence
   across return history/receipts/product data; a pattern-matching agent
   compares against known fraud signatures; a synthesizer produces a
   judgment with evidence and a confidence level, deferring ambiguous
   cases to a human.
8. **Evaluation:** Synthetic transaction data with injected fraud/non-
   fraud patterns; precision/recall vs. baseline thresholding.
9. **Data:** Fully synthetic — no sourcing risk, but "fraud" ground truth
   is definitionally our own construction, weakening evaluation
   credibility.
10. **Demo:** Functional but ethically delicate — a system that labels
    real customers as likely fraudsters requires a careful, cautious
    framing (human-review-required, never auto-deny) to be responsible.
11. **UI/UX:** Case queue with evidence trail and confidence, human
    approval gate before any action.
12. **Failure modes:** False accusations carry real customer-harm
    consequences even in a demo framing — must be scoped as decision-
    support only, never autonomous action, adding responsible-use
    overhead.
13. **Reproducibility:** Fine mechanically, weak evidentially (same issue
    as Candidates 4, 6, 8).
14. **Three-day feasibility:** Good technically.
15. **Differentiation:** Low — lowest novelty and user-value scores of the
    twelve; ethically requires the most hedging in framing.

---

## 6. Weighted Scoring

### Raw scores (1–10) across the requested ten dimensions

| # | Candidate | User Value | Agentic Depth | Eng. Difficulty | Novelty | Eval Strength | Meas. Improvement | Demo/Wow | UI/UX | Repro. | 3-Day Feasibility |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CVE Reachability Triage | 9 | 9 | 8 | 7 | 9 | 9 | 7 | 7 | 9 | 6 |
| 2 | Accessibility Remediation | 8 | 8 | 6 | 7 | 9 | 9 | 9 | 9 | 9 | 8 |
| 3 | Incident Root-Cause | 8 | 9 | 8 | 6 | 8 | 8 | 9 | 8 | 7 | 5 |
| 4 | Deployment Change-Risk | 7 | 7 | 7 | 5 | 6 | 6 | 6 | 6 | 6 | 5 |
| 5 | Invoice 3-Way Match | 6 | 6 | 5 | 4 | 7 | 7 | 5 | 6 | 8 | 8 |
| 6 | Lease Abstraction | 6 | 7 | 6 | 6 | 5 | 6 | 6 | 7 | 5 | 6 |
| 7 | Clinical Trial Matching | 8 | 7 | 7 | 6 | 6 | 7 | 7 | 7 | 5 | 4 |
| 8 | Claim Denial Appeal | 9 | 7 | 6 | 6 | 4 | 5 | 8 | 7 | 4 | 5 |
| 9 | Phishing/BEC Investigation | 8 | 8 | 7 | 6 | 6 | 7 | 8 | 7 | 5 | 6 |
| 10 | CI Flakiness Root-Cause | 5 | 7 | 7 | 6 | 7 | 7 | 5 | 6 | 7 | 7 |
| 11 | Privacy Data-Flow Auditor | 7 | 7 | 8 | 7 | 5 | 6 | 6 | 6 | 6 | 4 |
| 12 | Warranty/Return Fraud | 5 | 6 | 5 | 4 | 5 | 6 | 5 | 6 | 6 | 7 |

### Mapping to the official judging weights

`Weighted Score = 0.15×UserValue + 0.30×AgenticDepth + 0.20×avg(Demo/Wow, UI/UX) + 0.15×MeasuredImprovement + 0.15×Reproducibility + 0.05×Novelty`

Engineering Difficulty, Evaluation Strength, and Three-Day Feasibility are
carried as **gating/risk factors**, not score inputs — a high score built
on a low-feasibility foundation is a liability, not a strength.

| Rank | Candidate | Weighted Score | 3-Day Feasibility Flag |
|---|---|---|---|
| 1 | CVE Reachability Triage | **8.50** | Moderate risk (Day-1 dataset curation) |
| 2 | Accessibility Remediation | **8.45** | Low risk |
| 3 | Incident Root-Cause | **8.15** | Elevated risk (synthetic telemetry infra) |
| 4 | Phishing/BEC Investigation | 7.20 | Moderate (external-API temptation) |
| 5 | Clinical Trial Matching | 6.80 | Elevated risk |
| 6 | Insurance Claim Denial | 6.60 | Structural eval weakness, not just time |
| 7 | Privacy Data-Flow Auditor | 6.50 | Elevated risk |
| 8 | Deployment Change-Risk | 6.40 | Circular-ground-truth risk |
| 9 | CI Flakiness Root-Cause | 6.35 | Low risk, but low User Value ceiling |
| 10 | Invoice 3-Way Match | 6.25 | Low risk, low differentiation |
| 10 | Lease Abstraction | 6.25 | Ground-truth realism risk |
| 12 | Warranty/Return Fraud | 5.65 | Ethical framing overhead |

Candidates 1 and 2 are separated by 0.05 — effectively a statistical tie on
raw score. The tie-break is decided in Section 7–9 below, not by the table
alone.

## 7. Top 3 Finalists

1. **Reachability-Aware Vulnerability Triage Agent**
2. **Accessibility Violation Remediation Agent**
3. **Production Incident Root-Cause Investigation Agent**

## 8. Detailed Comparison of the Top 3

| Dimension | CVE Reachability Triage | Accessibility Remediation | Incident Root-Cause |
|---|---|---|---|
| Is the baseline literally "current industry practice"? | Yes — exactly what free SCA tools do | Yes — exactly what axe-core/WAVE do | Partially — naive correlation is a caricature, not a shipped tool |
| Does agentic depth feel *necessary*, not decorative? | Yes — no single prompt can safely trace a call graph | Mostly — a single well-tooled agent could plausibly do more of this than the other two | Yes — multi-signal correlation genuinely needs distinct roles |
| Ground truth quality | Real CVEs, real repos, hand-verified | Self-seeded, deterministic checker — cleanest possible | Fully synthetic, self-controlled |
| Data/infra to build before agent work starts | Low (public data, no infra) | Low (build one small demo app) | High (must build a believable telemetry generator) |
| Demo visual impact | Good (evidence board) | Excellent (live browser transformation, no narration needed) | Excellent (detective timeline) |
| Reproducibility for a judge with zero setup | Very high (pin commits + advisory IDs) | Highest (fully offline, self-contained) | High but depends on shipping the generator cleanly |
| Audience read (engineer-judges) | Very relatable pain (alert fatigue) | Very relatable, also legally/ethically resonant | Relatable, slightly more niche (SRE-specific) |
| Three-day risk concentration | Day 1 dataset curation | Spread evenly, lowest overall risk | Infra-heavy Day 1, compressing agent-build time |
| "Hot take" strength | Strong: presence ≠ exploitability | Strong: overlays don't fix anything, verified code fixes do | Good but less quotable |

## 9. Recommended Winner

**Reachability-Aware Vulnerability Triage Agent.**

It wins the tie-break against Accessibility Remediation for three reasons,
in order of importance:

1. **The 30%-weighted criterion favors it more cleanly.** Reachability
   analysis structurally *requires* distinct agent roles (locate → trace →
   check conditions → adversarially verify → synthesize) to be done
   safely at all — a single agent attempting this without that structure
   is exactly where hallucinated call paths creep in. The accessibility
   pipeline is equally well justified as multiple agents, but a
   reasonably well-tooled single agent could cover more of that ground
   without the same integrity risk, making the "why multiple agents"
   argument slightly less airtight.
2. **The baseline-to-advanced narrative is more universally legible to a
   technical judging panel.** "Your scanner just told you 42 things are
   wrong; we told you which 9 actually matter, and showed our work" is an
   immediate, visceral improvement story for an audience of engineers,
   most of whom have personally ignored a Dependabot alert.
3. **The hot take is sharper and more quotable**: *presence of a
   vulnerable dependency is not the same as exploitability, and treating
   them as equivalent is why security teams have learned to ignore their
   own alerts.*

Accessibility Remediation is the strongest alternative and carries
**less three-day execution risk** (Section 6). If reachability analysis
proves too hard to make robust by the end of Day 1 — the one real risk
this plan carries — the fallback is to pivot to Accessibility Remediation
rather than push a fragile version of the primary pick; the evaluation
harness pattern (fixed benchmark, baseline vs. advanced, evidence-cited
verdicts) transfers directly.

### Scoring against every judging criterion

- **Problem & User Value (15%):** Alert fatigue in dependency-vulnerability
  scanning is a widely and specifically felt pain among application
  security engineers and backend teams — not a vague "developers" claim.
- **Agent Solution & Engineering (30%):** Five roles, each catching a
  distinct failure mode (missed usage, wrong call path, unchecked
  precondition, overclaimed reachability, unsynthesized evidence) — none
  redundant, and a single-agent version is demonstrably less trustworthy.
- **End-to-End Quality (20%):** A working investigation board a judge can
  click through, baseline vs. advanced side by side, live on a real repo.
- **Measured Improvement (15%):** Concrete precision/recall/false-positive-
  rate numbers against a hand-verified benchmark, headline stat framed as
  "% of alerts correctly deprioritized without missing a true positive."
- **Reproducibility (15%):** Pinned commits, pinned advisory IDs, one
  script reproduces everything from a clean clone.
- **Hot Take (5%):** Presence ≠ exploitability — stated above.

## 10. Baseline Concept

**"Naive SCA" baseline** — for each dependency in the target repo, match
its installed version against known-vulnerable ranges pulled from OSV/
GHSA and flag every match as an open issue, with no code awareness
whatsoever. This is intentionally exactly what free/common tooling does
today, so any improvement we measure is an improvement *over real current
practice*, not a strawman.

## 11. Advanced Concept

A five-role pipeline over each baseline-flagged CVE:

- **Locator** — searches the target repo for imports/usages of the
  flagged package and, where the advisory names one, the specific
  vulnerable symbol.
- **Path-Tracer** — walks the call chain from application entry points
  (HTTP handlers, CLI entry, exported public API) toward the located
  usage, using code-reading/search tools rather than a bespoke static-
  analysis engine.
- **Condition Analyst** — checks any preconditions the advisory states
  (specific input shape, config flag, feature must be enabled) against
  what the code shows.
- **Adversary** — is explicitly prompted to try to refute the emerging
  reachability claim, forcing the case to survive active skepticism
  before being marked "Reachable."
- **Synthesizer** — emits a verdict (Reachable / Not Reachable /
  Uncertain), a confidence level, and a cited file:line evidence trail;
  every citation is programmatically checked to actually exist before
  being shown.

Working name for internal use: **REACH** (Reachability-Evidenced Agent for
CVE Hunting) — a placeholder, not a locked-in product identity.

## 12. Evaluation Strategy

- **Benchmark:** 15–20 real CVEs (scoped to one ecosystem, npm or PyPI, to
  bound engineering effort) paired with real public GitHub repos at
  pinned commit SHAs. Mix of genuinely reachable, present-but-unreachable,
  and deliberately borderline/ambiguous cases. Ground truth hand-verified
  and documented in the benchmark file itself, with the verifying
  reasoning included so judges can audit *our* ground truth, not just the
  agent's output.
- **Metrics:** precision/recall/F1 of "genuinely exploitable"
  classification vs. baseline's flag-everything behavior; false-positive-
  rate reduction (headline number); citation accuracy (cited file:line
  references checked to exist and say what's claimed); latency and cost
  per case; rate of correct deferral to "Uncertain" rather than a forced
  wrong answer.
- **Never fabricated:** every number in the final report traces to a
  stored raw agent transcript checked into the repo.

## 13. UI/UX Concept

An **investigation board**: one card per flagged CVE. Collapsed, it shows
the baseline label and the advanced verdict side by side. Expanded, it
shows the full evidence timeline — advisory text, located usage,
call-path graph from entry point to sink, condition-check result,
adversary transcript, final verdict with confidence — every claim
clickable back to the actual file:line in the repo. A summary header
shows the headline transformation: *"Naive scanner: 42 flagged → Agent:
9 confirmed exploitable, 33 deprioritized with evidence, 0 forced
guesses."*

## 14. Three-Day Implementation Risks

- **Day 1 dataset curation overruns.** Hand-verifying reachability ground
  truth for 15–20 real CVE/repo pairs is the single biggest time sink and
  the main threat to the whole plan.
- **Hallucinated call paths** undermining trust in the evidence trail.
- **Ecosystem/language sprawl** — trying to support multiple languages
  dilutes engineering time better spent making one ecosystem robust.
- **Scope creep into building a general static-analysis engine** instead
  of leaning on agentic, tool-assisted code reading.
- **Under-building the UI relative to the backend**, given End-to-End
  Quality is 20% of the score.

## 15. Risk Mitigation

- Timebox dataset curation to half a day; fall back to n=10 cases,
  clearly labeled as a smaller-but-still-real benchmark, rather than
  slipping the schedule.
- Prefer CVEs that already have public write-ups/PoCs describing
  reachability conditions — this converts "manual verification from
  scratch" into "verification against an existing credible source,"
  cutting curation time substantially. OSV.dev entries for some
  ecosystems (notably PyPI) also sometimes include affected-symbol
  information directly, which can bootstrap ground truth faster than
  reading advisory prose alone — worth checking first before assuming
  full manual tracing is required for every case.
- Scope V1 to a single ecosystem (npm or PyPI, decided once real
  candidate CVEs are scouted) rather than attempting both.
- Require every displayed evidence citation to be programmatically
  verified (file exists, line exists) before rendering — turns
  hallucination from a silent trust problem into a visible, logged
  failure mode we can report honestly.
- Build the UI skeleton in parallel with the second agent role, not after
  the whole pipeline is "done," so End-to-End Quality isn't a Day-3
  scramble.

## 16. What Would Make the Submission Memorable

Opening the demo on a **real, well-known open-source repository** and a
**real CVE that the judges themselves may recognize**, showing the naive
scanner's alert count, then watching the agent work through the evidence
live and land on a verdict a security engineer in the room would actually
trust enough to act on — closing on the baseline-vs-advanced number and
the one-sentence hot take.

## 17. Hot Take / Insight

**"A vulnerable dependency and an exploitable vulnerability are not the
same thing — and conflating them is why security teams have learned to
ignore their own alerts. An agent that reads code the way a human triager
actually would (entry point → call chain → sink, then try to prove itself
wrong) can restore signal to a system that's been crying wolf for years."**

---

## Open Question for Human Selection

Both finalists are strong enough to win outright; the recommendation above
is a judgment call, not a foregone conclusion. Before implementation
begins, please confirm:

1. Proceed with **Reachability-Aware Vulnerability Triage Agent** as
   recommended, or
2. Prefer **Accessibility Violation Remediation Agent** for its lower
   three-day execution risk, or
3. Something else entirely from the twelve analyzed above.

---

PROJECT DISCOVERY COMPLETE — awaiting human selection.
