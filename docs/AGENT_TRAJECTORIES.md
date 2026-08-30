# Agent Trajectories

Representative trajectories for the CVE Reachability advanced agent (single
headless Claude Code CLI invocation, restricted to `Read`/`Grep`/`Glob`), plus
the human-AI collaborative debugging trajectory that got the Tier B harness
from broken to working. Every trajectory below is a real captured run - no
step, tool call, or output has been invented or smoothed over.

---

## Trajectory 1  -  Tier A, `case-a-reachable-minimist` (CVE-2020-7598)

**Task given to the agent** (via `scripts/advanced/run_case.js`, delivered over
stdin): investigate whether `minimist@1.2.0`'s vulnerable `setKey()` behavior
is reachable from `fixtures/case-a-reachable-minimist`'s application code, and
under what conditions.

**Tools available:** `Read`, `Grep`, `Glob` only. No `Bash`, `Edit`, or `Write`
 -  the agent cannot execute or modify anything in the target repository.

**What the agent did (real, from the captured run):**
1. Used `Glob` on `**/*` to inventory the fixture directory before reading
   anything, per the system prompt's explicit instruction (`run_case.js`
   comments note this was necessary because the agent does not reliably infer
   its working directory from `--add-dir` alone).
2. Read `src/server.js:1-16`  -  found `handleParseArgsRequest`, registered as
   the handler for `router.post('/parse-args', ...)`, reading
   `rawArgs = req.body.args` (an HTTP request body field) and passing it
   unmodified into `minimist(rawArgs)` with no validation.
3. Read `node_modules/minimist/index.js:54-67`  -  found `setArg()` calling
   `setKey(argv, key.split('.'), value)`, deriving the key directly from the
   parsed argv flag name.
4. Read `node_modules/minimist/index.js:69-86`  -  found `setKey()` has no
   check excluding `__proto__`, `constructor`, or `prototype` from the keys
   array; it walks and unconditionally assigns `o[key] = value`.
5. Read `src/server.js:7-9`  -  found an inline comment explicitly documenting
   that `req.body.args` is attacker-controlled JSON, with an example payload.
6. Full-file review of `src/server.js` to confirm no sanitization/allow-listing
   exists anywhere in the application code before the `minimist()` call.

**Final structured output (real, unedited):**
- `verdict: REACHABLE`
- `confidence: 0.95`
- `evidence_completeness: 100%`
- `attacker_controlled_input: true`
- `reachable_path`: `HTTP request body (req.body.args) → src/server.js:11 → src/server.js:12 minimist(rawArgs) → node_modules/minimist/index.js setArg() line 62 → setKey() lines 69-86 performs unguarded o[key] = value allowing __proto__ traversal`
- `required_conditions`: payload must be an array of argv-style strings such
  as `['--__proto__.polluted', 'yes']`; no filtering occurs between
  `req.body.args` and the `minimist()` call
- Every evidence entry cites a real file and line range; independently
  re-verified against the filesystem by the evaluation harness (not trusted
  from the agent's own claim)
- Cost: $0.0519, duration: 30.8s

**Why this trajectory is representative:** it shows the baseline reachability
case  -  clean, single-hop, attacker input traced end to end to the exact
vulnerable line, with the agent explicitly citing the application's own
documenting comment as supporting evidence rather than just asserting the
conclusion.

---

## Trajectory 2  -  Tier B, `tb-2-marked-sanitize-bypass` (CVE-2016-10531)

**Task given to the agent:** investigate whether `marked@0.3.5`'s vulnerable
link-URI sanitizer is reachable in a real, unmodified fork of OWASP/NodeGoat
(pinned commit `c5cb68a7084e4ae7dcc60e6a98768720a81841e8`).

**Why this case matters:** NodeGoat's own source code contains a comment
reading `// Fix for A9 - Insecure Dependencies` directly beside
`marked.setOptions({ sanitize: true })`  -  the exact configuration CVE-2016-10531
defeats. This is a direct test of whether the agent trusts a
mitigating-looking comment or independently verifies the claim.

**What the agent did (real, from the captured run):**
1. Read `server.js:13`  -  confirmed `marked` is required and pinned at `0.3.5`
   in `package.json:17`.
2. Read `server.js:124-129`  -  found `marked.setOptions({ sanitize: true })`
   and `app.locals.marked = marked`, exposing marked globally to templates.
   Did **not** stop at the comment's claim that this was "the fix"  -  continued
   investigating whether `sanitize: true` actually neutralizes this specific
   CVE.
3. Read `app/views/memos.html:28-34`  -  found the template calls
   `marked(doc.memo)` directly once per stored memo.
4. Traced backward: `app/routes/memos.js:11-17` (`addMemos` takes
   `req.body.memo`  -  an HTTP POST field  -  with no sanitization) →
   `app/data/memos-dao.js:15-24` (persists the string unmodified to MongoDB)
   → `app/routes/memos.js:19-33` (`displayMemos` reads all stored memos back
   and renders them).
5. Read `app/routes/index.js:66-67`  -  confirmed the routes require only
   `isLoggedIn`, no further authorization or content validation.
6. Read `server.js:135-140`  -  found `swig.setDefaults({ autoescape: false })`,
   meaning marked's HTML output (including any bypassed dangerous URI) is
   written into the page completely unescaped.
7. Cross-referenced the CVE's actual mechanism (an HTML-entity-obfuscated
   dangerous URI scheme in a markdown link, e.g.
   `[x](javascript&#x3A;alert(1))`) against `sanitize: true`'s real behavior
    -  concluding the setting blocks obvious raw schemes but not
   entity-obfuscated ones, so the code comment's claim does not hold.

**Final structured output (real, unedited):**
- `verdict: REACHABLE`
- `confidence: 0.9`
- `evidence_completeness: 100%`
- 8 evidence entries, all independently verified against the real repository
- Explicitly notes in `uncertainties`: did not execute the actual marked
  0.3.5 source to line-by-line confirm the specific regex bypass logic;
  relied on the CVE description and the application's own tutorial page,
  which explicitly demonstrates this exact bypass against `sanitize: true`
- Cost: $0.0907, duration: 44.3s

**Why this trajectory is representative:** it is the sharpest test in the
entire benchmark of whether the agent does real verification versus pattern-
matching on reassuring-looking code  -  and it got it right, correctly
identifying that a security-looking configuration setting did not actually
neutralize the specific vulnerability being investigated.

---

## Trajectory 3  -  Tier B, `tb-1-underscore-dead-import` (CVE-2021-23358, NOT_REACHABLE)

Included to show a negative-result trajectory, not just the two REACHABLE
cases above  -  proving the agent doesn't default toward alarm.

**What the agent did (real, from the captured run):**
1. Read `config/config.js:1-16`  -  found the only `require("underscore")` in
   the entire repository; the bound variable `_` is never referenced again in
   that 16-line file.
2. Read `package.json:1-24` and `package-lock.json:26770-26773`  -  confirmed
   `underscore@1.9.1` is a direct production dependency at the flagged
   vulnerable version (ruling out "maybe it's not really installed" as an
   easy exit).
3. Read `server.js:1-17` and `server.js:116-142`  -  confirmed the actual
   templating engine wired up is `consolidate.swig`, not underscore's
   `_.template()`, and that `server.js` doesn't import underscore at all or
   re-export it indirectly.
4. Ran a repository-wide search for `_.\w+\(` and a separate search for
   `template(` across all `*.js` files  -  found no call sites anywhere in
   `app/routes/*.js`, `app/data/*.js`, or `server.js` invoking any underscore
   method.
5. Explicitly noted in `uncertainties`: did not trace whether a *transitive*
   dependency (e.g. `consolidate`, `swig`) internally calls underscore's
   `template()` with attacker data  -  scoped the investigation to
   application-source reachability per the task framing, and said so rather
   than silently ignoring the gap.

**Final structured output (real, unedited):**
- `verdict: NOT_REACHABLE`
- `confidence: 0.9`
- `evidence_completeness: 83%` (one evidence entry  -  the repo-wide grep
  itself  -  was marked "unverified" by the automated checker because it cited
  a search method rather than a file+line location; a real evaluator
  limitation, not an agent error, documented and fixed in the project's
  hardening pass)
- Cost: $0.1106, duration: 53.5s

---

## Trajectory 4  -  Human-AI Debugging Trajectory (Tier B execution, Day 2)

The hackathon brief explicitly asks trajectories to show "retries... and
human checkpoints"  -  this project's most consequential trajectory is not a
single agent run but the collaborative debugging arc that got Tier B from
completely broken to fully working. Full detail in
`docs/EXPERIMENT_LOG.md` Experiment 5; summarized here as a trajectory:

| Step | What was observed | Human/AI action | Result |
|---|---|---|---|
| 1 | `fetch_repos.sh` failed: `ENOENT` on a path with a doubled drive letter (`C:\c\Users\...`) | Diagnosed as a Git Bash `pwd` vs. `pwd -W` path-conversion issue inside a Node subshell | Fixed; repo cache populated correctly |
| 2 | `evaluate_tier_b.js` failed: `spawnSync claude ENOENT` | Diagnosed as Node's `spawnSync` being unable to resolve the `claude.cmd` Windows shim from the bare name `claude` | Fixed via the `cross-spawn` package |
| 3 | Advanced agent responded conversationally ("What would you like me to work on?") instead of investigating | Direct probe testing (`spawnSync` with a 3-line string vs. real CLI response) proved the model was receiving only the *first line* of a multi-line prompt  -  a Windows argv-newline-truncation bug | Fixed by delivering the investigation prompt via stdin and flattening the system prompt to one line |
| 4 | Agent addressed the orchestrator directly, referencing the wrong repository's git status | Diagnosed as the subprocess inheriting the orchestrator's own working directory | Fixed by pinning `cwd` to the fixture path in the `spawnSync` call |
| 5 | Evaluation harness crashed with `EISDIR` on one case | Diagnosed as an evidence entry citing a directory rather than a file, which `fs.readFileSync` cannot handle | Fixed by checking `fs.statSync(...).isFile()` before reading |

**Outcome:** after all five fixes, the full 5-case Tier B run completed
cleanly: **100% advanced accuracy vs. 40% baseline**, 0 false positives, real
evidence chains matching the manually-verified ground truth in every case.

This trajectory is included deliberately, not to obscure the agent's
reasoning quality behind infrastructure noise, but because it is the more
honest and more instructive story: across every real case tested, in two
separate evaluation tiers, **the agent's own reasoning never produced a
single incorrect verdict.** Every actual failure on the way to that result
was a Windows subprocess-plumbing issue, diagnosed and fixed one at a time,
each fix verified before moving to the next  -  exactly the "trace it
yourself" discipline the agent itself was asked to apply to CVE evidence.
