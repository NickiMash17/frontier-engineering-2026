# Frontier Engineering Challenge

## Mission

Build the strongest technically defensible solution to the official
Frontier Engineering Challenge 2026 problem.

## Engineering principles

1. Correctness before complexity.
2. Establish a working baseline before optimization.
3. Every major architectural improvement must be justified by evidence.
4. Never fabricate benchmark results.
5. Every meaningful experiment must be reproducible.
6. Write tests before claiming functionality is complete.
7. Preserve agent trajectories and important reasoning artifacts.
8. Keep secrets and credentials outside the repository.
9. Prefer deterministic behavior where possible.
10. Keep consequential external actions sandboxed.
11. Do not introduce dependencies without justification.
12. Optimize for the official acceptance tests and constraints.
13. Do not over-engineer before understanding the problem.

## Required development process

DISCOVER
→ PLAN
→ BASELINE
→ MEASURE
→ IDENTIFY FAILURE
→ IMPROVE
→ MEASURE AGAIN
→ HARDEN
→ REPRODUCE
→ DOCUMENT

## Competition requirements

The final submission must include:

- complete runnable source
- baseline implementation
- advanced implementation
- tests
- evaluation evidence
- improvement changelog
- reproduction instructions
- agent-use evidence
- final demonstration

Never mark an implementation complete unless it has been
validated against the available tests and requirements.

## Notes

Project selected: CVE Reachability — Application-Aware Vulnerability
Triage (see `docs/PROJECT_SELECTION.md`). Day-1 vertical slice complete
and passing its own gate (see `docs/EXPERIMENT_LOG.md`,
`docs/EVALUATION.md`). Architecture decisions and their justifications
are tracked in `docs/ARCHITECTURE_DECISIONS.md` — no role or dependency
gets added without a diagnosed failure or an explicit justification
recorded there, per principles 3, 11, and 13 above.
