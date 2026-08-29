'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compare, lessThan } = require('../scripts/version');

test('compare: basic ordering', () => {
  assert.equal(compare('1.2.0', '1.2.3'), -1);
  assert.equal(compare('1.2.3', '1.2.0'), 1);
  assert.equal(compare('1.2.3', '1.2.3'), 0);
});

test('compare: differing segment counts', () => {
  assert.equal(compare('1.2', '1.2.0'), 0);
  assert.equal(compare('1.2.1', '1.2'), 1);
});

test('lessThan matches the real advisory boundaries used in this project', () => {
  // CVE-2020-7598 (GHSA-vh95-rmgr-6w4m) minimist ranges
  assert.equal(lessThan('0.2.0', '0.2.1'), true);
  assert.equal(lessThan('0.2.1', '0.2.1'), false);
  assert.equal(lessThan('1.2.0', '1.2.3'), true);
  assert.equal(lessThan('1.2.3', '1.2.3'), false);
  // CVE-2019-10744 (GHSA-jf85-cpcp-j695) lodash range
  assert.equal(lessThan('4.17.11', '4.17.12'), true);
  assert.equal(lessThan('4.17.12', '4.17.12'), false);
});
