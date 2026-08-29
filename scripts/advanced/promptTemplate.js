'use strict';

// Builds the per-case investigation prompt. Learned from direct probing
// (docs/DAY1_IMPLEMENTATION_PLAN.md Section 3) that the agent does NOT
// infer its working directory from --add-dir alone -- the absolute path
// must be stated explicitly, and the agent must be told to Glob it first.
function buildPrompt({ fixtureAbsolutePath, advisory }) {
  return [
    `The target repository is at the absolute path: ${fixtureAbsolutePath}`,
    '',
    'Start by using Glob to list every file under that path (pattern "**/*"),',
    'then Read the files needed to answer the question below. Use Grep if it',
    'helps you find where a symbol is used across multiple files.',
    '',
    'A conventional dependency scanner has already flagged the following as a',
    'present, version-matched vulnerability in this repository. Your job is',
    'NOT to re-confirm the version match -- assume it is correct. Your job is',
    'to determine whether the vulnerable behavior is actually reachable from',
    'this application\'s code, and whether the conditions required for',
    'exploitation are actually present.',
    '',
    `  CVE: ${advisory.cve}`,
    `  Package: ${advisory.package}`,
    `  Installed version: ${advisory.installed_version}`,
    `  Vulnerable symbol: ${advisory.vulnerable_symbol}`,
    '',
    'Investigate:',
    '- Where (if anywhere) is this package actually imported and called in',
    '  this repository? Follow import chains through local wrapper modules --',
    '  a call site does not have to be in the same file as the import.',
    '- Is any usage reachable from something an external attacker can',
    '  influence (an HTTP request body, query string, header, etc.), as',
    '  opposed to only internal build tooling, tests, or hardcoded input?',
    '- Does reaching the vulnerable behavior require a specific payload shape',
    '  (e.g. a __proto__/constructor/prototype key) -- and if so, is anything',
    '  in the code path capable of stripping or blocking that shape before it',
    '  reaches the vulnerable function?',
    '',
    'Produce your answer as the required structured JSON only. Every entry in',
    '"evidence" must cite a real file path (relative to the repository root',
    'above) and a line range you actually read. Do not include any claim in',
    '"reachable_path" or "required_conditions" that is not backed by an',
    '"evidence" entry. If a claim is an absence (e.g. "no other file in this',
    'repository references this package"), mark that entry\'s "type" as',
    '"search" and describe the search you actually ran (e.g. "repo-wide grep',
    'for require(\'x\')") in "file" and "detail", with "n/a" in "lines" --',
    'do not force an absence claim into a fake file+line location.',
  ].join('\n');
}

module.exports = { buildPrompt };
