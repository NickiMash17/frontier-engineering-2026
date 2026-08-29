# Architecture Decisions

Short ADR-style records for decisions that would otherwise only live in
scattered commit messages. Each one states what was decided, why, and
what would change the decision.

---

## ADR-001: The advanced agent is a headless Claude Code CLI invocation, not an SDK dependency

**Decision:** The "advanced" reachability agent is implemented as a
per-case `spawnSync` call to the Claude Code CLI binary
(`$CLAUDE_CODE_EXECPATH`, falling back to `claude` on `PATH`) in `-p`
(print/headless) mode, restricted to `Read,Grep,Glob`, scoped to the
fixture directory via `--add-dir`, with structured output enforced via
`--json-schema`. No `@anthropic-ai` SDK package or `ANTHROPIC_API_KEY` is
added as a dependency.

**Why:** This machine already has an authenticated Claude Code session.
Reusing it needs zero new credentials and zero new dependencies. It was
validated empirically (not assumed) before being adopted -- see the
probe sequence below.

**What was learned before committing to this (in order):**
1. `--permission-mode bypassPermissions` on a nested invocation gets
   blocked by this session's own auto-mode classifier ("nested-agent-
   with-bypassed-permissions" is treated as a risky pattern). Fix: don't
   use it. Restricting `--tools` to read-only tools plus `--add-dir`
   scoping sandboxes the call adequately without it, and does not hang
   non-interactively -- out-of-scope file access is denied cleanly
   (`permission_denials` in the JSON result) rather than blocking on a
   prompt that can never be answered.
2. The default system prompt costs roughly 90K cache-creation tokens per
   cold call (~$0.30-0.36 before any real work). A short custom
   `--system-prompt` plus `--safe-mode` (skip CLAUDE.md/skills/plugin
   discovery) cut a validated probe call to ~$0.017-0.03 -- confirmed
   again across the full 4-case benchmark at ~$0.066/case average
   (Experiment 3 in `docs/EXPERIMENT_LOG.md`).
3. The agent does not infer its working directory from `--add-dir`
   alone. The prompt must state the absolute fixture path explicitly and
   instruct the agent to `Glob` it first, or it guesses wrong paths, gets
   denied, and silently produces a wrong answer instead of failing
   loudly (reproduced directly in an isolated probe before any fixture
   existed).

**Reproducibility consequence, stated plainly:** reproducing the advanced
system's results requires Claude Code itself, not just Node. This is
documented in the reproduction instructions rather than hidden -- it is
an accurate description of what was actually built.

**What would change this decision:** if headless CLI invocation proves
too fragile/expensive at Tier B scale (more cases, larger real repos),
the fallback is the Claude Agent SDK with a user-supplied
`ANTHROPIC_API_KEY` -- a bigger dependency, revisited only if the CLI
approach demonstrably breaks down, not preemptively.

---

## ADR-002: Baseline uses a hand-rolled version comparator, not the `semver` package

**Decision:** `scripts/version.js` is a ~15-line numeric x.y.z comparator.
No `semver` dependency was added.

**Why:** The only ranges this project needs are the exact, real ranges
pulled from two OSV.dev advisories -- plain `introduced`/`fixed` SEMVER
intervals with no pre-release, build-metadata, or caret/tilde range
syntax involved. A general-purpose range-parsing dependency is not
justified at this scope (CLAUDE.md principle 11: do not introduce
dependencies without justification).

**What would change this decision:** Tier B real-world repos may use
range syntax (`^`, `~`, OR-combined ranges) this comparator does not
handle. If so, `semver` becomes justified at that point -- not before.

---

## ADR-003: No additional agent role was added after Tier A (Experiment 3)

**Decision:** The advanced system remains a single, unstructured agent
call. The five-role pipeline (`locator -> path-tracer -> condition
analyst -> adversary -> synthesizer`) sketched in
`docs/PROJECT_SELECTION.md` was not implemented.

**Why:** Per the standing rule (`docs/CVE_REACHABILITY_PLAN.md` Section
5), a role is added only when a diagnosed failure specifically justifies
it. The single-agent version passed all four Tier A cases exactly,
including the two cases specifically designed to be hard for an
unstructured single call (`case-c`'s precondition/sanitization reasoning
and `case-d`'s one-hop-of-indirection call chain) -- see
`docs/EXPERIMENT_LOG.md` Experiment 3. There is no diagnosed failure to
attach a new role to.

**What would change this decision:** Tier B real-world repos are larger
and messier than controlled fixtures; if a specific failure mode shows up
there (e.g., the agent stops at the first file it finds and misses a
multi-hop call chain, or overclaims reachability on an ambiguous case),
the corresponding single role gets added -- and only that role, with the
specific failure it fixes documented in `docs/EXPERIMENT_LOG.md` first.

---

## ADR-004: Fixture "application entry points" are realistic but never executed

**Decision:** Tier A fixtures use recognizable Express-style handler
signatures (`function handleXRequest(req, res) {...}`, with a
`// Registered as: router.post(...)` comment marking the route) but do
not actually import or run `express`, and nothing in the evaluation
harness ever executes fixture application code.

**Why:** The whole point of the system is static, read-only
investigation -- the agent has no `Bash` tool and cannot execute
anything, and the evaluation harness only needs the code to be legible to
a reader, not runnable as a server. Adding a real `express` dependency
and wiring for code that is never executed would be unjustified weight.
The one place execution genuinely matters -- confirming a package version
is *actually* exploitable -- was done directly with real `node -e` calls
against the real installed package (Experiment 1), not simulated.
