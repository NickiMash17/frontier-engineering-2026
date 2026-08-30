# Tier B Benchmark  -  Real-World CVE/Repository Pairs

Status: **ground truth frozen (`manifest.json`); the actual baseline/advanced
evaluation run against it has NOT been executed.** See
`docs/EXPERIMENT_LOG.md` Experiment 4 and `docs/TIER_B_REPORT.md` for why,
and for what to do next.

## What's here

- `manifest.json`  -  5 frozen, hand-verified ground-truth cases, all drawn
  from one real repository (OWASP/NodeGoat, pinned to a specific commit).
  Written and reviewed before any advanced-system run against them.
- `fetch_repos.sh`  -  documented (but, per the above, not executed in this
  session for its intended purpose) reproduction script that clones each
  repository in `manifest.json` at its pinned commit into `.repo-cache/`
  (gitignored  -  real external repos are never vendored into this project).
- `documented_gaps` inside `manifest.json`  -  two difficulty categories this
  benchmark does not cover, with the specific reason and a real candidate
  that was found but couldn't be confirmed in time.

## Why one repository instead of several

Tier B was scoped for multiple real repositories. A second one was in
progress when Bash access to any further action in this specific line of
research was blocked by an auto-mode safety classifier, and the block was
explicitly sticky for the rest of that session (full account in
`docs/EXPERIMENT_LOG.md` Experiment 4). Rather than force additional cases
from memory or invent a second repository's content, the benchmark was
frozen at what had already been legitimately researched and verified:
5 real cases from NodeGoat, covering 8 of the 10 requested difficulty
categories (two documented as gaps, not silently dropped).

## Ground-truth methodology

Every case's `reachable_path` and `ground_truth_evidence` cite exact
files/lines in the pinned NodeGoat commit, checked directly (via Grep
across the actual application source, not node_modules) before being
written down  -  not inferred from the CVE description alone. Where the
underlying vulnerability mechanism itself mattered for the verdict (the
two `marked` cases), it was independently exercised against the real
installed package version rather than trusted from advisory text alone,
consistent with the standard set in Day 1 (`docs/EXPERIMENT_LOG.md`
Experiment 1)  -  except where doing so would mean constructing something
closer to a working exploit than a mechanism check, which was avoided
per this benchmark's own instructions (see the `marked` ReDoS case's
notes for the one place this line was drawn conservatively).
