# Frontend Plan

Status: planning only, per the Day 2/3 instructions. No frontend code,
framework install, or UI files exist yet. Everything in this document was
checked against the real files already on disk (`evaluation/results/*/results.json`,
`evaluation/results-tier-b/*/results.json`), not assumed from memory of
having written the harnesses.

## 1. Tech Stack

**Vanilla HTML/CSS/JS, ES modules, zero build step, zero frontend
framework.** One small node script (no bundler) pre-generates static JS
data files from the real result JSON already in the repo.

**Why, concretely:**

- There is no live backend to build. Every number this UI will ever show
  already exists as a committed JSON file, produced by
  `scripts/evaluate.js` / `scripts/evaluate_tier_b.js`. The frontend's
  entire job is to render existing data well, not to serve an API or run
  anything live. That is a data-visualization problem, not an
  application-framework problem.
- This project has already spent a disproportionate share of its time
  budget on cross-platform tooling friction (three separate Windows-
  specific CLI-invocation bugs, an auto-mode classifier blocking Bash for
  an entire session, `pwd` vs `pwd -W` path doubling). A React/Vite/etc.
  toolchain is another dependency surface that can break in exactly that
  way, for zero benefit given the actual complexity of what's being
  rendered (a handful of screens over a fixed, already-known JSON shape).
  Per CLAUDE.md principle 11 (don't introduce dependencies without
  justification) and principle 9 (prefer deterministic behavior), the
  simplest thing that can possibly work is the right default here, and it
  clearly can work -- this is well within what plain JS handles cleanly.
- Zero build step means "does it run" for a judge is one command
  (`npx serve frontend/` or `python -m http.server`, run from inside
  `frontend/` -- see the file:// caveat below) -- no install step, no
  version mismatch risk, no build failure mode to debug under submission
  deadline pressure.

**Required: a static server, not a double-clicked file.** `index.html`
uses ES modules (`<script type="module">`, `import`/`export`) so the data
generated in Section 2 can be cleanly `import`ed rather than smuggled in
as ad hoc globals. Browsers refuse to load ES modules from a `file://`
URL as a security restriction (a same-origin/CORS check that module
scripts enforce and classic `<script>` tags don't) -- double-clicking
`index.html` will fail silently or show a CORS error in the console, not
partially work. Running a static file server from inside `frontend/` --
`npx serve .` or `python -m http.server`, either is fine -- is therefore
a **required** step to view the page at all, not an optional convenience.
This must also be stated as a required step (not an aside) in whatever
reproduction guide eventually documents "how to view the submission."
- Reusable rendering is handled with small, focused render functions
  (one per screen/component) writing into DOM containers -- not a
  component framework, but not one giant unstructured script either.

**What would change this decision:** if the frontend needs to grow real
client-side interactivity beyond filtering/switching between
already-loaded data (e.g. a live re-run trigger, server-side state), that
would justify revisiting -- not before, and not preemptively.

## 2. File Layout

```text
scripts/frontend/
  generate_data.js       -- reads real result JSON, writes frontend/data/generated/*.js

frontend/
  index.html             -- app shell; loads generated data + app.js as ES modules
  styles.css
  app.js                 -- routing between the 4 screens (hash-based, no router lib)
  components/
    dashboard.js          -- screen 3 (results dashboard)
    caseDetail.js          -- screen 4 (CVE investigation detail -- hero screen)
    evidencePanel.js       -- screen 5 (evidence panel, used inside caseDetail)
    comparison.js          -- screen 6 (baseline-vs-advanced)
    replay.js              -- screen 1+2 (landing/scan + investigation/pipeline view)
  data/
    generated/
      tier-a.latest.js     -- `export const TIER_A = {...}` (generated, not hand-edited)
      tier-b.latest.js     -- `export const TIER_B = {...}` (generated, not hand-edited)
```

`scripts/frontend/generate_data.js` finds the most recent timestamped
directory under `evaluation/results/` and `evaluation/results-tier-b/`
(by directory-name sort, since the timestamp format is
lexicographically sortable) and writes each one's `results.json` content
into a plain `export const ... = {...}` JS file. This is a deliberate,
tiny, dependency-free step (not a bundler) so the static HTML page can
`<script type="module">`-import real data directly, with no `fetch()`
call and no CORS concern about reading a separate JSON file cross-origin.
It does **not** remove the need for a static server -- see Section 1's
file:// caveat: ES module `import`/`export` itself is blocked under
`file://` regardless of what the imported data looks like, so
`frontend/` must always be served, never opened directly. Re-running the
generator after a new real evaluation run is the only "update the
frontend's data" step that ever exists.

## 3. Screen-by-Screen Breakdown

### Screen 1 — Landing / Replay Select

Not a live scanner (there is no live backend) and not framed as one. It
lists the real recorded runs available (`Tier A -- 4 cases -- 2026-08-29`,
`Tier B -- 5 cases -- 2026-08-29`) pulled from the generated data's own
timestamp, and an explicit, visible label: *"Replaying a real,
previously-recorded evaluation run"* -- never implying a live agent
executes in the browser. This is a deliberate honesty choice: the whole
project's credibility rests on not fabricating results, and a frontend
that *looks* like it's live-scanning when it's actually replaying a
static file would quietly violate that even if every number shown is
real.

### Screen 2 — Investigation View (pipeline stages)

An animated, staged reveal of the real pipeline using the real captured
timing/cost/verdict data -- not fabricated pacing. Two stages, matching
the actual architecture exactly (**not** a five-role pipeline that
doesn't exist -- ADR-003/ADR-005 explicitly kept this a single agent, and
the UI must not visually misrepresent that):

```text
[ Baseline Scan ]  ──────────▶  [ Advanced Investigation (single agent) ]
  version-match only              Read / Grep / Glob, per case
  flags N as VULNERABLE           verdict + evidence + confidence
```

For each case, the advanced stage reveals in real recorded order:
Glob → evidence gathered → verdict, using the real per-case
`duration_ms` to pace the reveal (scaled down for watchability, e.g. real
54s shown over ~2-3s, linearly proportional across cases so relative
pacing stays honest) rather than an arbitrary fixed animation speed.

### Screen 3 — Results Dashboard

Top-level summary strip: accuracy (baseline vs. advanced), false
positives, total cost, avg latency -- for whichever tier is selected.
Below it, a compact case list (one row per case: case_id, CVE, ground
truth, baseline verdict, advanced verdict, correct/incorrect indicator)
that links into Screen 4 per row. This is the screen a judge lands on
after Screen 1's replay selection.

### Screen 4 — CVE Investigation Detail (hero screen)

Per-case deep dive, the flagship screen:

```text
CVE-2016-10531                                    marked@0.3.5
────────────────────────────────────────────────────────────────
GROUND TRUTH        BASELINE              ADVANCED
REACHABLE            VULNERABLE            REACHABLE  ✓ match

Confidence: 0.90                    Evidence completeness: 100%

REACHABLE PATH
  app/routes/memos.js → app/data/memos-dao.js → app/views/memos.html:31

REQUIRED CONDITIONS
  • sanitize:true is set (app believes this is a fix -- CVE bypasses it)
  • attacker-submitted markdown with an HTML-entity-obfuscated URI scheme

[ VIEW EVIDENCE ]   [ VIEW BASELINE COMPARISON ]
```

Verdict badges are colored by meaning, not decoration (see Section 6):
ground truth is neutral/reference-colored, baseline and advanced are each
colored green (matches ground truth) or red (doesn't), so a mismatch is
visible in under a second without reading text.

**Must handle `advanced.ok === false` explicitly.** Every field this
screen otherwise renders -- `advanced.verdict`, `advanced.confidence`,
`advanced.evidence_completeness`, `advanced.full_output` -- is `null` (or
absent) when the CLI invocation itself failed rather than the agent
producing a verdict (`scripts/advanced/run_case.js`'s error-path return
shape). This is a real, already-observed state, not a hypothetical edge
case -- it's exactly the shape returned for a timeout, a budget cap, or
an unparseable CLI response. The case-detail render function must check
`advanced.ok` first and, when false, show `advanced.error` in place of
the verdict/evidence/confidence section (a plain "investigation failed:
<error text>" state, styled distinctly from a real `UNCERTAIN` verdict so
the two are never confused) -- never assume `full_output` or
`evidence_entries` exist and let a `TypeError` on `null.something` be
the actual failure mode a judge sees.

### Screen 5 — Evidence Panel

Each evidence entry from `advanced.evidence_entries`, rendered as:

```text
[FILE]  server.js:124-129                                    ✓ verified
"marked is imported and configured with sanitize:true..."

[SEARCH] repo-wide grep for require('underscore')            ✓ verified
"No other file in the repository references underscore."
```

The `[FILE]` vs `[SEARCH]` badge directly surfaces the evidence-type
distinction added in this session's hardening pass
(`scripts/evaluate_tier_b.js` `checkEvidence`, `scripts/advanced/schema.json`)
-- a `[SEARCH]` entry documents an absence claim and is a distinct, valid
category, not a downgraded or failed `[FILE]` citation. An entry with
`verified: false` is shown with a visible reason string next to it
("out of bounds", "file does not exist"), never silently hidden -- an
unverified claim being visibly flagged is the entire point of
independent evidence checking, and hiding it would defeat that.

### Screen 6 — Baseline vs. Advanced Comparison

The headline visualization the project's pitch (`docs/PROJECT_SELECTION.md`)
promised, filled with the real numbers instead of a mockup:

```text
                    TIER A (n=4)         TIER B (n=5)
Baseline flags       4 VULNERABLE         5 VULNERABLE
Advanced confirms     2 REACHABLE          2 REACHABLE
Advanced clears        2 not a risk         3 not a risk
Accuracy             50%  →  100%         40%  →  100%
```

Directly reuses Screen 3's summary numbers in a side-by-side layout --
this is a view, not a separately computed metric.

## 4. Data Contract

Two real shapes exist today, verified directly against the actual files
on disk (not assumed from the scripts that generated them):

**Tier A** (`evaluation/results/*/results.json`, e.g.
`2026-08-29T05-28-25-444Z/results.json`):

```text
{
  summary: {
    total_cases: number,
    baseline: { risk_classification_accuracy, false_positives, false_negatives },
    advanced: { cases_completed_ok, cases_errored, exact_verdict_accuracy,
                risk_classification_accuracy, false_positives, false_negatives,
                avg_evidence_completeness, total_cost_usd, avg_duration_ms },
  },
  results: [ <case result>, ... ],
}
```

**Tier B** (`evaluation/results-tier-b/*/results.json`): **no top-level
`summary` object** -- just `{ results: [...] }`. The frontend computes its
own summary strip (Screen 3) from the per-case array for Tier B, and
prefers the precomputed `summary` for Tier A when present. This
asymmetry is real (verified by reading both files directly), not an
oversight to paper over -- documented here so the render code handles
both shapes explicitly rather than assuming one.

**Per-case result shape** (field by field, union of both tiers --
Tier-A-only and Tier-B-only fields marked):

| Field | Type | Notes |
|---|---|---|
| `case_id` | string | e.g. `"tb-2-marked-sanitize-bypass"` |
| `cve` | string | |
| `package` | string | **Tier B only** (Tier A's fixture names encode the package) |
| `difficulty_category` | string[] | **Tier B only** |
| `ground_truth_verdict` | string | one of `REACHABLE` / `NOT_REACHABLE` / `CONDITION_NOT_SATISFIED` / `UNCERTAIN` |
| `baseline.verdict` | string | `VULNERABLE` / `NOT_VULNERABLE` |
| `baseline.predicts_risk` | boolean | |
| `baseline.correct_risk_classification` | boolean | |
| `advanced.ok` | boolean | false if the CLI invocation itself failed -- when false, every other `advanced.*` field below except `error` may be `null`/absent; see Screen 4's required handling in Section 3 |
| `advanced.error` | string \| null | |
| `advanced.verdict` | string \| null | same enum as ground truth |
| `advanced.exact_verdict_match` | boolean | |
| `advanced.predicts_risk` | boolean \| null | |
| `advanced.correct_risk_classification` | boolean \| null | |
| `advanced.confidence` | number (0-1) \| null | agent's self-reported confidence -- **never used as the correctness metric**, only ever displayed alongside it |
| `advanced.evidence_completeness` | number (0-1) \| null | fraction of `evidence_entries` independently verified |
| `advanced.evidence_entries` | array | see below |
| `advanced.full_output` | object \| null | the complete raw structured output from the agent (schema in `scripts/advanced/schema.json`) -- `usage_sites`, `reachable_path`, `required_conditions`, `attacker_controlled_input`, `uncertainties` all live here |
| `advanced.total_cost_usd` | number | |
| `advanced.duration_ms` | number | |
| `advanced.permission_denials` | array | almost always empty in practice; shown only if non-empty |

**Evidence entry shape** (`advanced.evidence_entries[]`, matches
`scripts/advanced/schema.json`'s `evidence` items post-hardening):

| Field | Type | Notes |
|---|---|---|
| `type` | `"file"` \| `"search"` | **optional, added in this session's hardening pass** -- absent on every entry recorded before it existed; the frontend must treat a missing `type` as `"file"`, matching the checker's own default |
| `file` | string | file path for `type:"file"`; a search-method description for `type:"search"` (e.g. `"repo-wide grep for require('underscore')"`) |
| `lines` | string | e.g. `"124-129"`, or `"n/a"` for `type:"search"` |
| `detail` | string | the claim this evidence supports |
| `verified` | boolean | set by the independent checker, not the agent |
| `reason` | string \| null | populated only when `verified: false` |

## 5. Populating the Initial Version With Real Data

1. `node scripts/frontend/generate_data.js` reads the most recent
   directory under `evaluation/results/` and under
   `evaluation/results-tier-b/` and writes
   `frontend/data/generated/tier-a.latest.js` /
   `tier-b.latest.js` as plain `export const TIER_A = {...}` /
   `export const TIER_B = {...}` modules -- a direct copy of the real
   JSON already verified on disk, not synthesized.
2. `frontend/index.html` imports those two generated modules directly. No
   demo/mock/placeholder data path exists anywhere in the code -- if the
   generated files are missing, the page should say so plainly rather
   than fall back to invented numbers.
3. Every screen in Section 3 is designed against the *actual* field names
   and value ranges observed in the two real files read while writing
   this plan (Section 4), not a hypothetical future shape.

## 6. What "Premium, Serious Security Product" Means Concretely

Not vague adjectives -- specific, checkable choices, informed by how
real tools in this space (Snyk, Semgrep, GitHub code scanning) actually
present findings:

- **Severity/verdict color is semantic, never decorative.** Exactly
  three meanings get color: matches ground truth (green), contradicts
  ground truth (red), uncertain/not-yet-verified (amber/gray). Nothing
  else in the UI uses these three colors for anything else.
- **Monospace type for anything that is code, a path, or an identifier**
  (file paths, line ranges, CVE IDs, package@version) -- this is the
  single most recognizable visual signature of a real security tool vs. a
  generic dashboard, and it's free.
- **Evidence is shown as citations, not prose paragraphs.** Each entry is
  a compact `file:lines` breadcrumb (monospace, clickable-looking even if
  not wired to actually open the file) followed by the one-sentence claim
  it supports -- this is Semgrep/GitHub-code-scanning's exact pattern for
  a reason: it lets a reviewer verify a claim in one glance without
  reading a wall of text.
- **Confidence is a small, secondary indicator, not a hero number.** A
  short bar or percentage next to the verdict badge, never a large
  gauge/dial competing with the verdict itself for attention -- the
  verdict is the finding; confidence is metadata about the finding.
- **Numbers that matter for trust (cost, latency) are visible but
  quiet** -- small monospace text near the case row, not styled as an
  achievement metric. This project's own selling point is that its
  claims are cheap and fast to verify, which reads better shown plainly
  than emphasized.
- **Baseline is never drawn as "wrong" in isolation** -- it's drawn
  faithfully alongside the ground truth and the advanced verdict so its
  false positives are visible as a comparison, not a strawman. The whole
  argument is "here is what a real, unmodified conventional tool would
  have told you," and overstating its wrongness visually would undercut
  that credibility.
- **No card-grid dashboard filled with icons for their own sake.** Every
  visual element maps to a real field in Section 4 -- if a screen has an
  element that isn't backed by a real field, it doesn't belong on the
  screen (this is the same discipline the evaluation harness applies to
  numbers, applied to pixels).

## 7. Time Budget

Assuming roughly a working day remains before hardening/polish needs to
give way to recording the demo video and final submission checks:

| Task | Estimate |
|---|---|
| `scripts/frontend/generate_data.js` + verify against real files | 45 min |
| `index.html` shell + `styles.css` design tokens (colors, type scale) | 45 min |
| Screen 3 (dashboard) + Screen 4 (case detail, hero) | 2 hr |
| Screen 5 (evidence panel, incl. file/search badge) + Screen 6 (comparison) | 1.5 hr |
| Screen 1+2 (replay landing + paced pipeline animation) | 1.5 hr |
| Cross-check every rendered number against the real JSON by hand | 30 min |
| Responsive pass + light/dark theme check | 45 min |
| Buffer | 1 hr |
| **Total** | **~9 hr** |

If time is short, Screens 3, 4, and 5 (dashboard, hero detail, evidence)
are the load-bearing ones for judging criteria (End-to-End Quality,
Measured Improvement) -- Screens 1/2/6 are the ones to cut or simplify
first if the budget doesn't hold.

---

HARDENING + FRONTEND PLAN COMPLETE — awaiting review before frontend implementation begins.
