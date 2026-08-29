'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const schema = require('../scripts/advanced/schema.json');

const REQUIRED_FIELDS = [
  'cve',
  'package',
  'installed_version',
  'vulnerable_symbol',
  'usage_sites',
  'reachable_path',
  'required_conditions',
  'attacker_controlled_input',
  'verdict',
  'confidence',
  'evidence',
  'uncertainties',
];

test('advanced output schema requires exactly the documented fields', () => {
  assert.deepEqual([...schema.required].sort(), [...REQUIRED_FIELDS].sort());
  assert.equal(schema.additionalProperties, false, 'schema must not allow unsupported claims via extra fields');
});

test('verdict enum matches the four documented outcomes', () => {
  assert.deepEqual(schema.properties.verdict.enum, [
    'REACHABLE',
    'NOT_REACHABLE',
    'CONDITION_NOT_SATISFIED',
    'UNCERTAIN',
  ]);
});

test('evidence entries require file, lines, and detail -- no unsupported prose-only claims', () => {
  const evidenceItem = schema.properties.evidence.items;
  assert.deepEqual([...evidenceItem.required].sort(), ['detail', 'file', 'lines']);
  assert.equal(evidenceItem.additionalProperties, false);
});
