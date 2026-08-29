# CVE Reachability — Application-Aware Vulnerability Triage

Frontier Engineering Challenge 2026 submission (individual, online).

Conventional dependency scanners (`npm audit`, Dependabot) flag a repo the
instant a package version matches a known CVE range, regardless of
whether the vulnerable code is ever actually reachable from the
application. This project investigates application-specific
**reachability**: given a CVE a baseline scanner has already flagged, an
agent reads the target repository and determines whether the vulnerable
behavior is actually reachable, under what conditions, with a
file-and-line evidence trail — instead of trusting the version match
alone.

See [docs/PROJECT_SELECTION.md](docs/PROJECT_SELECTION.md) for why this
problem was chosen over eleven other candidates, and
[docs/CVE_REACHABILITY_PLAN.md](docs/CVE_REACHABILITY_PLAN.md) /
[docs/DAY1_IMPLEMENTATION_PLAN.md](docs/DAY1_IMPLEMENTATION_PLAN.md) for
how it was built.

## Quick start

```bash
npm test              # deterministic test suite (baseline, fixtures, schema) — free, no API calls
npm run baseline       # naive version-match scanner across all Tier A fixtures
npm run evaluate        # full baseline vs. advanced benchmark — invokes the Claude Code CLI, real cost/time
```

`npm run evaluate` requires a working, authenticated Claude Code
installation (`$CLAUDE_CODE_EXECPATH` or `claude` on `PATH`) — see
[docs/ARCHITECTURE_DECISIONS.md](docs/ARCHITECTURE_DECISIONS.md) ADR-001
for why, and what that means for reproducing results.

## Process

DISCOVER → PLAN → BASELINE → MEASURE → IDENTIFY FAILURE → IMPROVE →
MEASURE AGAIN → HARDEN → REPRODUCE → DOCUMENT

See [CLAUDE.md](./CLAUDE.md) for the full engineering constitution guiding
this project, and [docs/EXPERIMENT_LOG.md](docs/EXPERIMENT_LOG.md) /
[docs/EVALUATION.md](docs/EVALUATION.md) for what's actually been run and
measured so far.

## Status

- [x] Workspace initialized
- [x] Problem selected (CVE Reachability, from 12 analyzed candidates)
- [x] Baseline implementation (naive version-match scanner)
- [x] Advanced implementation — Day-1 vertical slice (single agent, Tier A)
- [x] Tier A benchmark (4 controlled cases, 100% risk-classification accuracy)
- [ ] Tier B benchmark (real-world CVE/repo pairs)
- [ ] UI
- [ ] Final submission
