'use strict';

// Regression guard for the Windows argv-truncation bug fixed in
// docs/EXPERIMENT_LOG.md Experiment 5: a multi-line string passed as a
// single argv element to the Claude Code CLI was silently truncated at
// its first newline on Windows. The fix was to deliver the investigation
// prompt via stdin (spawnSync's `input` option) instead of argv, and to
// flatten the system prompt to a single line so it stays safe to pass via
// argv. These tests assert both hold, without ever invoking the real CLI.
//
// cross-spawn's `sync` export is stubbed BEFORE run_case.js is first
// required in this process, so run_case.js's own top-level
// `const spawnSync = require('cross-spawn').sync` captures the stub.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const crossSpawn = require('cross-spawn');

let lastCall = null;

crossSpawn.sync = (command, args, options) => {
  lastCall = { command, args, options };
  return {
    stdout: JSON.stringify({
      is_error: false,
      structured_output: {
        cve: '',
        package: '',
        installed_version: '',
        vulnerable_symbol: '',
        usage_sites: [],
        reachable_path: [],
        required_conditions: [],
        attacker_controlled_input: false,
        verdict: 'UNCERTAIN',
        confidence: 0,
        evidence: [],
        uncertainties: [],
      },
      total_cost_usd: 0,
      duration_ms: 0,
      permission_denials: [],
      session_id: 'test-session',
    }),
    stderr: '',
    error: null,
  };
};

const { runAdvancedCase } = require('../scripts/advanced/run_case');
const { buildPrompt } = require('../scripts/advanced/promptTemplate');
const { SYSTEM_PROMPT } = require('../scripts/advanced/systemPrompt');

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'case-a-reachable-minimist');
const ADVISORY = {
  cve: 'CVE-2020-7598',
  package: 'minimist',
  installed_version: '1.2.0',
  vulnerable_symbol: 'setKey()',
};

test('the full multi-line investigation prompt is delivered via stdin, not argv', () => {
  runAdvancedCase(FIXTURE_DIR, ADVISORY);

  const expectedPrompt = buildPrompt({
    fixtureAbsolutePath: path.resolve(FIXTURE_DIR),
    advisory: ADVISORY,
  });

  // Sanity check: this guard is meaningless if the prompt is ever
  // collapsed to one line -- it must actually be multi-line to prove
  // anything about the truncation bug.
  assert.ok(expectedPrompt.includes('\n'), 'test fixture assumption broken: buildPrompt no longer produces a multi-line prompt');

  assert.equal(lastCall.options.input, expectedPrompt, 'the exact, full prompt must be delivered via the input option');
  assert.equal(lastCall.args.includes(expectedPrompt), false, 'the prompt must never appear as an argv element');
});

test('the prompt delivered via stdin is not truncated at the first line', () => {
  runAdvancedCase(FIXTURE_DIR, ADVISORY);

  // The historical bug: a 3-line probe prompt arrived at the model as
  // only its first line. Assert content from the *last* line of the
  // prompt survives, not just the first -- that's what truncation would
  // have destroyed.
  const lastLine = 'do not force an absence claim into a fake file+line location.';
  assert.ok(
    lastCall.options.input.includes(lastLine),
    'content from the end of the prompt is missing -- looks truncated'
  );
});

test('no argv element passed to the CLI contains an embedded newline', () => {
  runAdvancedCase(FIXTURE_DIR, ADVISORY);

  const multilineArgs = lastCall.args.filter((a) => typeof a === 'string' && a.includes('\n'));
  assert.deepEqual(multilineArgs, [], 'no CLI argument may contain a newline on Windows -- it gets silently truncated');
});

test('"-p" is passed as a bare flag with no value argument following it', () => {
  runAdvancedCase(FIXTURE_DIR, ADVISORY);

  const pIndex = lastCall.args.indexOf('-p');
  assert.notEqual(pIndex, -1, '-p flag must be present');
  assert.equal(
    lastCall.args[pIndex + 1],
    '--system-prompt',
    '-p must not be followed by the prompt text -- it is delivered via stdin instead'
  );
});

test('the system prompt has no embedded newlines and is passed via argv unchanged', () => {
  assert.ok(!SYSTEM_PROMPT.includes('\n'), 'SYSTEM_PROMPT must be single-line to stay safe as an argv element on Windows');

  runAdvancedCase(FIXTURE_DIR, ADVISORY);
  assert.ok(lastCall.args.includes(SYSTEM_PROMPT), 'the exact system prompt must be passed via argv');
});
