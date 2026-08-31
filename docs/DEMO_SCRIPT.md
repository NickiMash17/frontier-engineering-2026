# Demo Script - CVE Reachability

Target length: **5 minutes** (the competition's own stated ceiling for a
demonstration - see `docs/PROJECT_SELECTION.md` Section 2). Written to be
read almost verbatim, with stage directions in *italics* separated from
spoken lines. Every number in this script is a real, verified figure from
`evaluation/results/2026-08-29T05-28-25-444Z/results.json` (Tier A) and
`evaluation/results-tier-b/2026-08-29T13-12-24-798Z/results.json` (Tier
B) - nothing here is rounded up or invented for effect.

**Live URL:** https://cve-reachability-triage.vercel.app
**Backup (if the live site is down):** `node scripts/frontend/generate_data.js && cd frontend && npx serve .` (see README.md Section 5)

---

## Before you start

- Open the live URL in a fresh tab, on the **Landing** screen (`/#/`),
  **before** you start talking - don't demo the page load itself.
- Have a second tab ready on `/#/case/tier-b/tb-2-marked-sanitize-bypass`
  (the money-shot case) so you can flip to it instantly instead of
  clicking through if time is tight.
- Know your one-click theme toggle (top-right sun/moon icon) - use it
  once, deliberately, don't fiddle with it.
- Silence count-up animations by pausing half a beat after each
  navigation before you start talking over that screen - they take
  ~600ms and look broken if you talk over the number still climbing.

---

## 0:00-0:30 - The hook

*(On Landing, hero visible, nothing clicked yet.)*

> "Every vulnerability scanner you've ever used - `npm audit`,
> Dependabot, Snyk - does the exact same thing: it checks if a package
> **version** matches a known CVE. That's it. It never checks whether
> your application code actually **calls** the vulnerable function, or
> whether reaching it even requires something that isn't true in your
> app.
>
> That's the gap this project closes. Given a CVE a normal scanner has
> already flagged, an agent reads the real application code and decides:
> is this actually reachable, or is the scanner crying wolf?"

---

## 0:30-1:00 - What's on screen right now

*(Point at the hero stat - "40% → 100%".)*

> "This number is real, not a mockup. It's the actual accuracy of a naive
> version-match baseline - the thing every scanner does today - versus
> this project's agent, on five real CVEs in a real, unmodified
> application: OWASP's NodeGoat."

---

## 1:00-2:15 - Live walkthrough: one real investigation

*(Navigate to `/#/dashboard/tier-b` - the Results Dashboard.)*

> "This is the results dashboard for that five-case real-world run.
> Hundred percent accuracy, advanced side. Zero false positives, down
> from three on the baseline. Fifty-seven cents total cost for all five
> investigations - real Claude Code API spend, not estimated."

*(Click into `tb-2-marked-sanitize-bypass` - or switch to your
pre-opened second tab. Let the trace diagram finish drawing itself in,
~2 seconds, before speaking.)*

> "This is the case I actually want to show you. `marked` version 0.3.5,
> a real cross-site-scripting CVE. Here's the interesting part -"

*(Scroll down to the Reachable Path list, point at step 6-7 or read the
evidence entry citing `server.js:126-129`.)*

> "- the application's own source code has a comment right next to the
> vulnerable configuration that says, quote, 'Fix for A9 - Insecure
> Dependencies.' A naive read would stop there and mark it safe. The
> agent didn't stop there. It kept tracing: is `sanitize: true` actually
> sufficient against *this specific* CVE's bypass technique? It wasn't.
> The agent traced the full path anyway - through the memo route, the
> database, the template render, and a second setting three lines away,
> `autoescape: false`, that made the whole thing exploitable in
> practice."

*(Scroll to the Evidence panel - point at 2-3 citations with their
file:line and the green "verified" checkmark.)*

> "Every one of these citations is independently re-verified against the
> real filesystem - the file exists, the line range is real. This isn't
> the agent's word for it."

---

## 2:15-2:45 - The negative case, briefly

*(Navigate back to the dashboard, point at `tb-1-underscore-dead-import`
row - NOT_REACHABLE, both baseline VULNERABLE and advanced
NOT_REACHABLE badges visible.)*

> "And it's not just an alarm bell. This case - `underscore`, flagged
> vulnerable by the baseline - the agent found the import, confirmed the
> version, then proved it's never actually called anywhere in the
> running application. Correctly downgraded. The system doesn't just
> find danger, it clears noise too - which is the entire point: judgment,
> not just detection."

---

## 2:45-3:30 - The architecture decision, and why it matters

*(Optional: navigate to `/#/compare` here, or stay put - whichever flows
better live. Let the "40% → 100%" hero numbers glow in before talking.)*

> "The original plan for this project was a five-role agent pipeline -
> locator, path-tracer, condition analyst, adversary, synthesizer. I
> didn't build it. One single agent, with just three tools - Read, Grep,
> Glob - did this. Across nine real cases in two separate evaluation
> tiers, it never produced a single wrong verdict. Not once. The rule I
> held myself to the whole build: complexity is earned by a diagnosed
> failure, not added because it sounds more impressive. No failure
> happened, so no extra roles got added."

---

## 3:30-4:15 - The honest part

> "Here's the part I want to be upfront about, because it's the more
> interesting story anyway. Every failure on the way to these results
> was infrastructure, not the model. A doubled drive letter from a
> Windows path bug. A `.cmd` shim Node's built-in process spawner
> couldn't resolve. A multi-line prompt that silently got truncated to
> its first line by the Windows argument-passing chain - which meant, for
> a while, the agent was receiving no real task at all and just asking
> what to do. Five bugs, found and fixed one at a time, each verified
> before moving to the next. Once the agent actually received its real
> task, it got the verdict right, every single time, on the first try."

---

## 4:15-4:45 - Close on the number, and the sentence

*(Back on `/#/compare` if not already there - the big glowing "100%"
should be the last thing on screen.)*

> "A vulnerable dependency and an exploitable vulnerability are not the
> same thing - and conflating them is exactly why security teams have
> learned to ignore their own alerts. This agent reads code the way an
> actual security engineer would: trace the path, then try to prove
> itself wrong before it says 'exploitable.'"

---

## 4:45-5:00 - Sign-off

> "Full source, both benchmark tiers, every ADR, and the real agent
> transcripts behind every number here are all in the repo. Thank you."

---

## If you have extra time (30-60s filler, pick one)

- **Light/dark toggle**: click it once on any screen. *"Two real themes,
  not a filter - 'Live Trace' and 'Blueprint,' both driven by the same
  design tokens."*
- **Pipeline Replay** (`/#/replay/tier-b/tb-2-marked-sanitize-bypass`):
  *"This isn't a fake loading animation - the pacing is the case's real
  recorded latency, scaled down proportionally so relative timing stays
  honest."*
- **Cost/latency framing**: *"About eleven cents and fifty-four seconds
  per case, end to end, for a real security engineer's manual triage
  time of ten to thirty minutes. That's the trade being offered here."*

## If a judge interrupts to ask something (quick answers, don't script these live)

- **"Why not multiple agents?"** → No diagnosed failure across 9 real
  cases in two tiers; see `docs/ARCHITECTURE_DECISIONS.md` ADR-005.
  Complexity has to be earned, not assumed.
- **"Is this reproducible?"** → Yes - pinned commit SHAs, pinned advisory
  IDs, one script per tier (`npm run evaluate`, `node
  scripts/evaluate_tier_b.js`), frozen ground truth in git.
- **"What's the actual failure mode?"** → Infrastructure, not reasoning
  - five Windows-specific subprocess bugs, all fixed and logged in
  `docs/EXPERIMENT_LOG.md` Experiment 5. Zero verdict failures from the
  model itself.
- **"How much did this cost to build/run?"** → $0.2636 total for Tier A
  (4 cases), $0.5680 total for Tier B (5 cases) - real API spend, not
  estimated.
- **"What's the sample size caveat?"** → n=5 for Tier B, one repository,
  8 of 10 originally-scoped difficulty categories (two documented as
  gaps, not silently dropped) - stated explicitly in
  `docs/TIER_B_REPORT.md` Section 9, not hidden.
