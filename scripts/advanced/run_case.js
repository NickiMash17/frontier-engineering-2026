'use strict';

// Invokes the Claude Code CLI in headless mode as the reachability-
// investigation agent for one Tier A case. See
// docs/DAY1_IMPLEMENTATION_PLAN.md Section 3 for why the CLI is invoked
// this way (no bypassPermissions, custom system prompt, --safe-mode) and
// what was empirically validated before this was written.

const { spawnSync } = require('child_process');
const path = require('path');
const { SYSTEM_PROMPT } = require('./systemPrompt');
const { buildPrompt } = require('./promptTemplate');
const schema = require('./schema.json');

function resolveClaudeBinary() {
  return process.env.CLAUDE_CODE_EXECPATH || 'claude';
}

// Runs the advanced agent against one fixture directory for one advisory
// record (as produced by scripts/baseline.js). Returns a normalized
// result; never throws for an agent-side failure -- a failed/errored run
// is a valid, reportable outcome for the evaluation harness, not an
// exception.
function runAdvancedCase(fixtureDir, advisory, options = {}) {
  const fixtureAbsolutePath = path.resolve(fixtureDir);
  const prompt = buildPrompt({ fixtureAbsolutePath, advisory });
  const maxBudgetUsd = options.maxBudgetUsd || 1.0;
  const model = options.model || 'sonnet';

  const args = [
    '-p', prompt,
    '--system-prompt', SYSTEM_PROMPT,
    '--safe-mode',
    '--tools', 'Read,Grep,Glob',
    '--add-dir', fixtureAbsolutePath,
    '--output-format', 'json',
    '--json-schema', JSON.stringify(schema),
    '--model', model,
    '--no-session-persistence',
    '--max-budget-usd', String(maxBudgetUsd),
  ];

  const startedAt = Date.now();
  const proc = spawnSync(resolveClaudeBinary(), args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: options.timeoutMs || 180000,
  });
  const wallClockMs = Date.now() - startedAt;

  if (proc.error) {
    return {
      case_dir: fixtureDir,
      cve: advisory.cve,
      ok: false,
      error: `failed to invoke claude CLI: ${proc.error.message}`,
      wall_clock_ms: wallClockMs,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(proc.stdout);
  } catch (err) {
    return {
      case_dir: fixtureDir,
      cve: advisory.cve,
      ok: false,
      error: `could not parse CLI output as JSON: ${err.message}`,
      raw_stdout: proc.stdout,
      raw_stderr: proc.stderr,
      wall_clock_ms: wallClockMs,
    };
  }

  if (parsed.is_error || !parsed.structured_output) {
    return {
      case_dir: fixtureDir,
      cve: advisory.cve,
      ok: false,
      error: parsed.errors ? parsed.errors.join('; ') : (parsed.subtype || 'unknown agent error'),
      permission_denials: parsed.permission_denials || [],
      total_cost_usd: parsed.total_cost_usd,
      duration_ms: parsed.duration_ms,
      wall_clock_ms: wallClockMs,
    };
  }

  return {
    case_dir: fixtureDir,
    cve: advisory.cve,
    ok: true,
    output: parsed.structured_output,
    permission_denials: parsed.permission_denials || [],
    total_cost_usd: parsed.total_cost_usd,
    duration_ms: parsed.duration_ms,
    wall_clock_ms: wallClockMs,
    session_id: parsed.session_id,
  };
}

module.exports = { runAdvancedCase, resolveClaudeBinary };

if (require.main === module) {
  const fixtureDir = process.argv[2];
  const cve = process.argv[3];
  if (!fixtureDir || !cve) {
    console.error('Usage: node scripts/advanced/run_case.js <fixtureDir> <CVE-ID>');
    process.exit(1);
  }
  const { loadAdvisories, getInstalledVersion } = require('../baseline');
  const advisory = loadAdvisories().find((a) => a.cve === cve);
  if (!advisory) {
    console.error(`No advisory found for ${cve} in data/advisories/index.json`);
    process.exit(1);
  }
  const installedVersion = getInstalledVersion(path.resolve(fixtureDir), advisory.package);
  const caseContext = { ...advisory, installed_version: installedVersion };
  const result = runAdvancedCase(fixtureDir, caseContext);
  console.log(JSON.stringify(result, null, 2));
}
